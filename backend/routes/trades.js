const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Trade = require('../models/Trade');
const DebateMessage = require('../models/DebateMessage');
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// POST /api/trades/:id/chat
router.post('/:id/chat', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { question } = req.body;

    try {
        // 1. Fetch trade record
        const trade = await Trade.findOne({
            where: { id, user_id: req.user.id }
        });

        if (!trade) {
            return res.status(404).json({ success: false, message: 'Trade not found' });
        }

        // 2. Fetch candles before trade (24 hours)
        const candlesBefore = await sequelize.query(
            `SELECT * FROM coin_price_history 
             WHERE asset = :asset AND timeframe = '1h' AND open_time < :entryTime
             ORDER BY open_time DESC LIMIT 24`,
            {
                replacements: { asset: trade.asset, entryTime: trade.created_at },
                type: QueryTypes.SELECT
            }
        );

        // 3. Fetch candles during trade
        const tradeEndTime = trade.updated_at || new Date();
        const candlesDuring = await sequelize.query(
            `SELECT * FROM coin_price_history 
             WHERE asset = :asset AND timeframe = '1h' AND open_time >= :entryTime AND open_time <= :endTime
             ORDER BY open_time ASC`,
            {
                replacements: { 
                    asset: trade.asset, 
                    entryTime: trade.created_at,
                    endTime: tradeEndTime
                },
                type: QueryTypes.SELECT
            }
        );

        // 4. Fetch agent debate messages
        const debateMessages = await DebateMessage.findAll({
            where: { cycle_id: trade.cycle_id },
            order: [['created_at', 'ASC']]
        });

        // 5. Build context string (with limits to prevent rate-limit/token issues)
        // If there are too many candles during the trade, take the first 24 and the last 24.
        let formattedCandlesDuring = candlesDuring;
        let skippedCandlesMessage = '';
        if (candlesDuring.length > 48) {
            const first24 = candlesDuring.slice(0, 24);
            const last24 = candlesDuring.slice(-24);
            formattedCandlesDuring = [...first24, { open_time: '... (middle candles omitted) ...' }, ...last24];
            skippedCandlesMessage = `\n(Note: ${candlesDuring.length - 48} middle hours omitted to fit context limits)`;
        }

        let context = `
TRADE DATA:
- Asset: ${trade.asset}
- Direction: ${trade.direction}
- Status: ${trade.status}
- Entry Price: ${trade.entry_price}
- Exit Price: ${trade.close_price || 'N/A'}
- Stop Loss: ${trade.stop_loss}
- Take Profit: ${trade.take_profit}
- P&L: ${trade.pnl || 'N/A'}
- Leverage: ${trade.leverage}x
- Created At: ${trade.created_at}

MARKET CONTEXT (24H BEFORE ENTRY):
${candlesBefore.reverse().map(c => `[${c.open_time}] O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join('\n')}

MARKET ACTION (DURING TRADE):${skippedCandlesMessage}
${formattedCandlesDuring.map(c => c.open === undefined ? c.open_time : `[${c.open_time}] O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join('\n')}

AGENT DEBATE LOG:
${debateMessages.map(m => `[${m.agent_name}]: ${m.content}`).join('\n\n')}
`;

        // 6. Send to Groq with streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a Senior Trading Analyst assistant. You have access to trade execution data, market context (OHLCV), and the internal AI agent debate for this trade. 
                    
                    Your role:
                    1. Answer the user's specific question concisely using the provided data.
                    2. If they say 'hi' or greet you, be friendly and briefly offer to explain the trade's entry, risk, or market context.
                    3. Only provide a deep "Why" analysis if they ask for it or ask a relevant question.
                    4. Use the context to back up your claims with specific price levels or agent signals.`
                },
                {
                    role: 'user',
                    content: `Context: ${context}\n\nUser Question: ${question}`
                }
            ],
            model: 'llama-3.3-70b-versatile',
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Chat error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to generate chat response' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
            res.end();
        }
    }
});

module.exports = router;

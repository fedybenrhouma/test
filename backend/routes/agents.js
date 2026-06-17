const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const socketService = require('../services/socket');
const Trade = require('../models/Trade');
const DebateCycle = require('../models/DebateCycle');
const DebateMessage = require('../models/DebateMessage');
const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Start Agents Debate
router.post('/start', verifyToken, async (req, res) => {
  try {
    const { asset, timeframe, targetPrice, margin } = req.body;
    const userId = req.user.id;

    if (!asset) {
      return res.status(400).json({ success: false, message: 'Asset is required' });
    }

    console.log(`🚀 Triggering agents for ${asset} on ${timeframe || '1h'} (User: ${userId}, Target: ${targetPrice || 'Market'}, Margin: ${margin || 'Default'})`);

    // Path to the python executable in the venv
    const pythonPath = path.join(__dirname, '../../agents/venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../agents/test_mas.py');

    // Spawn the process
    const pythonProcess = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        ASSET: asset,
        TIMEFRAME: timeframe || '1h',
        TARGET_PRICE: targetPrice || '',
        MARGIN: margin || '',
        USER_ID: userId,
        PYTHONPATH: path.join(__dirname, '../../agents')
      },
      cwd: path.join(__dirname, '../../agents')
    });

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Agents STDOUT: ${output}`);
      
      // Emit live debate message via WebSockets
      try {
        const io = socketService.getIO();
        io.to(userId).emit('agent_message', { 
            message: output, 
            asset: asset,
            timestamp: new Date()
        });
      } catch (err) {
        // Socket might not be initialized yet in edge cases
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      console.error(`Agents STDERR: ${errorOutput}`);
      
      try {
        const io = socketService.getIO();
        io.to(userId).emit('agent_error', { 
            message: errorOutput, 
            asset: asset
        });
      } catch (err) {}
    });

    pythonProcess.on('close', (code) => {
      console.log(`Agents process exited with code ${code}`);
      try {
        const io = socketService.getIO();
        io.to(userId).emit('agent_debate_completed', { 
            asset: asset, 
            code: code 
        });
      } catch (err) {}
    });

    return res.status(200).json({
      success: true,
      message: 'Agents triggered successfully. The debate has started.'
    });
  } catch (error) {
    console.error('Start agents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting agents',
      error: error.message
    });
  }
});

// Global Assistant Chat
router.post('/chat', verifyToken, async (req, res) => {
    const { question } = req.body;
    const userId = req.user.id;

    try {
        // Fetch user data for context
        const openTrades = await Trade.findAll({ 
            where: { user_id: userId, status: 'open' },
            limit: 10 
        });
        
        const recentCycles = await DebateCycle.findAll({ 
            where: { user_id: userId }, 
            limit: 3, 
            order: [['created_at', 'DESC']],
            include: [{ 
                model: DebateMessage, 
                as: 'messages',
                limit: 10
            }]
        });

        const systemPrompt = `You are the Hive-Mind Assistant, the conversational interface for a Multi-Agent System (MAS) trading platform.
        You assist users by interpreting agent debates and managing their portfolio.
        
        Current User Context:
        - Open Trades: ${openTrades.map(t => `${t.asset} ${t.direction} at ${t.entry_price}`).join(', ') || 'None'}
        - Recent Debates: ${recentCycles.map(c => `${c.asset} (${c.recommendation})`).join(', ') || 'No recent debates'}
        
        Guidelines:
        1. Be concise but insightful.
        2. If asked about market trends, refer to recent agent consensus.
        3. Use a tone that is professional, slightly futuristic, and data-driven.
        4. If you don't have enough data, suggest starting a new analysis via the 'Analysis' menu.`;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
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
        console.error('Global Chat Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Assistant is currently offline.' });
        } else {
            res.end();
        }
    }
});

module.exports = router;

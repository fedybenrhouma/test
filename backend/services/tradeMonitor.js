const Trade = require('../models/Trade');
const Alert = require('../models/Alert');
const { v4: uuidv4 } = require('uuid');
const Binance = require('node-binance-api');
const socketService = require('./socket');

const binance = new Binance().options({
    family: 1, // Optional: forces IPv4 to avoid ENOTFOUND issues sometimes
});

// Track open trades in memory for instant O(1) checks
let openTrades = [];

// Sync trades from DB every 10 seconds to catch newly opened ones
async function syncTrades() {
    try {
        openTrades = await Trade.findAll({ where: { status: 'open' } });
    } catch (err) {
        console.error('[Trade Monitor] Error syncing trades:', err.message);
    }
}

async function closeTrade(trade, reason, currentPrice) {
    try {
        // Prevent double close by removing from memory immediately
        openTrades = openTrades.filter(t => t.id !== trade.id);

        const existing = await Trade.findByPk(trade.id);
        if (!existing || existing.status === 'closed') return;

        const isLong = trade.direction === 'long';
        let pnl = 0;
        
        if (isLong) {
            pnl = (currentPrice - parseFloat(trade.entry_price)) * parseFloat(trade.position_size);
        } else {
            pnl = (parseFloat(trade.entry_price) - currentPrice) * parseFloat(trade.position_size);
        }

        // Add leverage if it's there
        pnl = pnl * (trade.leverage || 1);

        await existing.update({
            status: 'closed',
            close_reason: reason,
            close_price: currentPrice,
            pnl: pnl,
            updated_at: new Date()
        });

        // Create an alert
        const symbolClean = trade.asset.split('/')[0];
        const coinId = symbolClean.toLowerCase();
        const reasonText = reason.replace('_', ' ').toUpperCase();
        const pnlText = `${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`;
        
        const message = `Closed ${trade.direction.toUpperCase()} position at $${currentPrice.toFixed(2)}. Reason: ${reasonText}. PNL: ${pnlText}`;
        
        const alert = await Alert.create({
            id: uuidv4(),
            userId: trade.user_id,
            coinId: coinId,
            symbol: symbolClean,
            targetPrice: currentPrice,
            condition: 'above',
            isTriggered: true,
            triggeredAt: new Date(),
            isRead: false,
            type: 'trade',
            message: message
        });

        console.log(`[Trade Monitor] ⚡ CLOSED TRADE ${trade.id} (${trade.asset}) | Reason: ${reasonText} | PNL: ${pnlText}`);
        
        // Emit WebSocket events
        try {
            const io = socketService.getIO();
            io.to(trade.user_id).emit('trade_closed', { trade: existing, reason: reasonText, pnl: pnl });
            io.to(trade.user_id).emit('alert_triggered', alert);
        } catch (socketErr) {
            console.error('[Trade Monitor] Failed to emit socket event:', socketErr.message);
        }
        
    } catch (err) {
        console.error(`[Trade Monitor] Error closing trade ${trade.id}:`, err.message);
    }
}

function startRealtimeMonitor() {
    console.log('🚀 [Trade Monitor] Starting Instant WebSocket Monitor for SL/TP...');
    
    // Initial sync and periodic sync
    syncTrades();
    setInterval(syncTrades, 10000);

    let lastLogTime = Date.now();

    // Listen to all mini tickers via WebSocket (instant updates, ~1-100ms latency)
    binance.websockets.miniTicker(markets => {
        if (!openTrades.length) return;

        const now = Date.now();
        const shouldLog = now - lastLogTime > 10000;
        if (shouldLog) lastLogTime = now;

        // Iterate through open trades safely
        for (let i = 0; i < openTrades.length; i++) {
            const trade = openTrades[i];
            
            // Convert 'BNB/USDT' -> 'BNBUSDT'
            const symbol = trade.asset.replace('/', '');
            
            if (markets[symbol]) {
                const currentPrice = parseFloat(markets[symbol].close);
                
                const sl = parseFloat(trade.stop_loss);
                const tp = parseFloat(trade.take_profit);

                if (shouldLog) {
                    console.log(`[Trade Monitor] ${trade.asset} (${trade.direction.toUpperCase()}) | Live: $${currentPrice.toFixed(2)} | TP: $${tp.toFixed(2)} | SL: $${sl.toFixed(2)}`);
                }

                if (trade.direction === 'long') {
                    if (currentPrice <= sl) {
                        closeTrade(trade, 'stop_loss', currentPrice);
                    } else if (currentPrice >= tp) {
                        closeTrade(trade, 'take_profit', currentPrice);
                    }
                } else if (trade.direction === 'short') {
                    if (currentPrice >= sl) {
                        closeTrade(trade, 'stop_loss', currentPrice);
                    } else if (currentPrice <= tp) {
                        closeTrade(trade, 'take_profit', currentPrice);
                    }
                }
            }
        }
    });
}

module.exports = { startRealtimeMonitor };
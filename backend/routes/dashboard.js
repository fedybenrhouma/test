const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const DebateCycle = require('../models/DebateCycle');
const DebateMessage = require('../models/DebateMessage');
const Trade = require('../models/Trade');
const { Op } = require('sequelize');

// Get Dashboard Data
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get Open Trades
    const openTrades = await Trade.findAll({
      where: { user_id: userId, status: 'open' },
      order: [['created_at', 'DESC']]
    });

    // 2. Get Recent Debate Cycles (with messages)
    const recentCycles = await DebateCycle.findAll({
      where: { user_id: userId },
      include: [{
        model: DebateMessage,
        as: 'messages',
        order: [['created_at', 'ASC']]
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // 3. Calculate Stats
    // P&L Today (simplified - sum of closed trades today or open pnl)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const closedToday = await Trade.findAll({
      where: {
        user_id: userId,
        status: 'closed',
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const pnlToday = closedToday.reduce((sum, trade) => sum + parseFloat(trade.pnl || 0), 0);

    // Win Rate (all time)
    const allClosed = await Trade.count({ where: { user_id: userId, status: 'closed' } });
    const allWins = await Trade.count({ 
      where: { 
        user_id: userId, 
        status: 'closed',
        pnl: { [Op.gt]: 0 }
      } 
    });
    
    const winRate = allClosed > 0 ? (allWins / allClosed) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          pnlToday,
          winRate,
          openPositionsCount: openTrades.length,
          activeDebatesCount: recentCycles.filter(c => c.status === 'pending').length
        },
        openTrades,
        recentCycles
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// Get All Debates
router.get('/debates', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const debates = await DebateCycle.findAll({
      where: { user_id: userId },
      include: [{
        model: DebateMessage,
        as: 'messages'
      }],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      debates
    });
  } catch (error) {
    console.error('Fetch debates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching debates',
      error: error.message
    });
  }
});

// Get All Trades
router.get('/trades', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const trades = await Trade.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      trades
    });
  } catch (error) {
    console.error('Fetch trades error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching trades',
      error: error.message
    });
  }
});

// Close Trade Manually
router.post('/trades/:id/close', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const trade = await Trade.findOne({
      where: { id, user_id: userId, status: 'open' }
    });

    if (!trade) {
      return res.status(404).json({ success: false, message: 'Open trade not found' });
    }

    // Fetch current price from Binance
    const axios = require('axios');
    const symbol = trade.asset.replace('/', '');
    const priceRes = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const currentPrice = parseFloat(priceRes.data.price);

    // Calculate PNL
    let pnl = 0;
    if (trade.direction === 'long') {
      pnl = (currentPrice - parseFloat(trade.entry_price)) * parseFloat(trade.position_size);
    } else {
      pnl = (parseFloat(trade.entry_price) - currentPrice) * parseFloat(trade.position_size);
    }

    // Update trade
    trade.status = 'closed';
    trade.close_reason = 'manual';
    trade.close_price = currentPrice;
    trade.pnl = pnl;
    trade.updated_at = new Date();
    await trade.save();
    
    // Create Alert
    const Alert = require('../models/Alert');
    const coinId = trade.asset.split('/')[0].toLowerCase();
    const formattedPrice = currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedPnl = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const message = `Manually closed ${trade.direction.toUpperCase()} position at $${formattedPrice}. PNL: ${pnl >= 0 ? '+' : '-'}$${formattedPnl}`;
    
    await Alert.create({
      userId: trade.user_id,
      coinId: coinId,
      symbol: trade.asset.split('/')[0],
      targetPrice: currentPrice,
      condition: 'above',
      isTriggered: true,
      triggeredAt: new Date(),
      isRead: false,
      type: 'trade',
      message: message
    });

    return res.status(200).json({
      success: true,
      message: 'Trade closed successfully',
      trade
    });

  } catch (error) {
    console.error('Close trade error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error closing trade',
      error: error.message
    });
  }
});

module.exports = router;

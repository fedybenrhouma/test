const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// GET /api/admin/users - List all users with their info
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'binanceApiKey', 'binanceApiSecret'] },
      order: [['createdAt', 'DESC']]
    });
    
    // Enrich with active subscription info
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const userData = user.toJSON();
      userData.isProActive = user.isProActive();
      return userData;
    }));

    res.json({ success: true, users: enrichedUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/give-pro - Give pro subscription to a user
router.post('/give-pro', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, days, planName } = req.body;
    
    if (!userId || !days) {
      return res.status(400).json({ success: false, message: 'Missing userId or days' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const now = new Date();
    const currentExpiry = user.proExpiry && user.proExpiry > now ? new Date(user.proExpiry) : now;
    const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);

    await user.update({
      isPro: true,
      proExpiry: newExpiry
    });

    // Create a manual subscription record
    await Subscription.create({
      userId: user.id,
      planId: 'admin-gift',
      planName: planName || `Admin Gift - ${days} Days`,
      amount: 0.00,
      durationDays: days,
      status: 'active',
      startDate: now,
      endDate: newExpiry
    });

    res.json({ 
      success: true, 
      message: `User ${user.email} is now PRO until ${newExpiry.toLocaleDateString()}`,
      proExpiry: newExpiry
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin/bans - List all banned users
router.get('/bans', verifyToken, isAdmin, async (req, res) => {
  try {
    const bannedUsers = await User.findAll({
      where: { isBanned: true },
      attributes: { exclude: ['password', 'binanceApiKey', 'binanceApiSecret'] },
      order: [['updatedAt', 'DESC']]
    });
    res.json({ success: true, bans: bannedUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/ban - Ban a user
router.post('/ban', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId, days, reason } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot ban an admin' });
    }

    let banExpires = null;
    if (days && days > 0) {
      banExpires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    await user.update({
      isBanned: true,
      banReason: reason || 'Violation of terms',
      banExpires: banExpires
    });

    res.json({ 
      success: true, 
      message: `User ${user.email} has been banned`,
      banExpires: banExpires
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/unban - Unban a user
router.post('/unban', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await user.update({
      isBanned: false,
      banReason: null,
      banExpires: null
    });

    res.json({ 
      success: true, 
      message: `User ${user.email} has been unbanned`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/make-admin - Make a user an admin
router.post('/make-admin', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await user.update({ role: 'admin' });
    res.json({ success: true, message: `User ${user.email} is now an admin` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/remove-admin - Remove admin role from a user
router.post('/remove-admin', verifyToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Safety: Don't allow removing own admin status
    if (user.id === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot remove your own admin privileges' });
    }

    await user.update({ role: 'user' });
    res.json({ success: true, message: `User ${user.email} is no longer an admin` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

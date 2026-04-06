const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

const Watchlist = require('../models/Watchlist');

// Get current user profile (protected route)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message,
    });
  }
});

// Update user profile (protected route)
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, username, email } = req.body;

    console.log('Update profile request for user:', req.user.id);
    console.log('Data:', { firstName, lastName, username, email });

    // Validate input
    if (!firstName || !lastName || !username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide firstName, lastName, username, and email',
      });
    }

    // Find user
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if username is taken by another user (if changing username)
    if (username !== user.username) {
      const existingUser = await User.findOne({
        where: { username },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    // Check if email is taken by another user (if changing email)
    if (email !== user.email) {
      const existingEmail = await User.findOne({
        where: { email },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken',
        });
      }
    }

    // Update user fields
    await user.update({
      firstName,
      lastName,
      username,
      email,
    });

    console.log('Profile updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message,
    });
  }
});

// Change password (protected route)
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log('Change password request from user:', req.user.id);

    if (!currentPassword || !newPassword) {
      console.log('Missing password fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password',
      });
    }

    // Get user
    const user = await User.findByPk(req.user.id);

    if (!user) {
      console.log('User not found:', req.user.id);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('User found, verifying current password...');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      console.log('Current password is incorrect');
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    console.log('Current password verified, updating to new password...');

    // Update password
    user.password = newPassword;
    await user.save();

    console.log('Password updated successfully');

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message,
    });
  }
});

// --- Watchlist Routes ---
const redisClient = require('../config/redis');

// Get user's watchlist
router.get('/watchlist', verifyToken, async (req, res) => {
  try {
    const cacheKey = `watchlist:${req.user.id}`;
    
    // Check cache first
    try {
      const cachedWatchlist = await redisClient.v4.get(cacheKey);
      if (cachedWatchlist) {
        return res.status(200).json({
          success: true,
          watchlist: JSON.parse(cachedWatchlist),
          source: 'cache'
        });
      }
    } catch (cacheErr) {
      console.warn('Redis cache read error:', cacheErr.message);
    }

    // If not in cache, query DB
    const watchlist = await Watchlist.findAll({
      where: { userId: req.user.id },
      attributes: ['coinId']
    });
    
    const coinIds = watchlist.map(w => w.coinId);

    // Save to cache (expire in 1 hour)
    try {
      await redisClient.v4.setEx(cacheKey, 3600, JSON.stringify(coinIds));
    } catch (cacheErr) {
      console.warn('Redis cache write error:', cacheErr.message);
    }
    
    return res.status(200).json({
      success: true,
      watchlist: coinIds,
      source: 'database'
    });
  } catch (error) {
    console.error('Get watchlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching watchlist',
      error: error.message
    });
  }
});

// Add coin to watchlist
router.post('/watchlist', verifyToken, async (req, res) => {
  try {
    const { coinId } = req.body;
    if (!coinId) {
      return res.status(400).json({ success: false, message: 'Coin ID is required' });
    }

    const [watchlistItem, created] = await Watchlist.findOrCreate({
      where: { userId: req.user.id, coinId }
    });

    if (created) {
      // Invalidate cache since watchlist changed
      const cacheKey = `watchlist:${req.user.id}`;
      try {
        await redisClient.v4.del(cacheKey);
      } catch (cacheErr) {
        console.warn('Redis cache delete error:', cacheErr.message);
      }
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Added to watchlist' : 'Already in watchlist'
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding to watchlist',
      error: error.message
    });
  }
});

// Remove coin from watchlist
router.delete('/watchlist/:coinId', verifyToken, async (req, res) => {
  try {
    const { coinId } = req.params;
    
    const deleted = await Watchlist.destroy({
      where: { userId: req.user.id, coinId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Coin not found in watchlist' });
    }

    // Invalidate cache since watchlist changed
    const cacheKey = `watchlist:${req.user.id}`;
    try {
      await redisClient.v4.del(cacheKey);
    } catch (cacheErr) {
      console.warn('Redis cache delete error:', cacheErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Removed from watchlist'
    });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing from watchlist',
      error: error.message
    });
  }
});

module.exports = router;

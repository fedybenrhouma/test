const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

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
    const { firstName, lastName, username } = req.body;

    console.log('Update profile request for user:', req.user.id);
    console.log('Data:', { firstName, lastName, username });

    // Validate input
    if (!firstName || !lastName || !username) {
      return res.status(400).json({
        success: false,
        message: 'Please provide firstName, lastName, and username',
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

    // Update user fields
    await user.update({
      firstName,
      lastName,
      username,
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

module.exports = router;

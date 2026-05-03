const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with that email or username',
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const user = await User.create({
      email,
      username,
      password,
      firstName,
      lastName,
      verificationToken,
    });

    // Send emails (fire and forget so it doesn't block the response)
    sendWelcomeEmail(user.email, user.firstName).catch(err => console.error('Welcome email failed:', err));
    sendVerificationEmail(user.email, user.firstName, verificationToken).catch(err => console.error('Verification email failed:', err));

    // Generate token
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in registration',
      error: error.message,
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is banned
    if (user.isBanned) {
      // Check if ban has expired
      if (user.banExpires && new Date() > user.banExpires) {
        // Automatically unban
        await user.update({ isBanned: false, banReason: null, banExpires: null });
      } else {
        return res.status(403).json({
          success: false,
          isBanned: true,
          message: 'Your account has been restricted',
          banReason: user.banReason,
          banExpires: user.banExpires,
          user: user.getPublicProfile() // Still return user info for the UI
        });
      }
    }

    // Generate token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: user.getPublicProfile(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in login',
      error: error.message,
    });
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });

    await user.update({
      isEmailVerified: true,
      verificationToken: null
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ success: true, message: 'If an account with that email exists, we have sent a password reset link.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetExpires
    });

    await sendPasswordResetEmail(user.email, user.firstName, resetToken);

    res.json({ success: true, message: 'If an account with that email exists, we have sent a password reset link.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });

    const user = await User.findOne({ 
      where: { 
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() } // Must not be expired
      } 
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });

    // Set new password - the User model hooks will handle hashing automatically
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Resend Verification Email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (user.isEmailVerified) return res.status(400).json({ success: false, message: 'Email is already verified' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await user.update({ verificationToken });

    sendVerificationEmail(user.email, user.firstName, verificationToken).catch(err => console.error('Verification email failed:', err));

    res.json({ success: true, message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Resend verification email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

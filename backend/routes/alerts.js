const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { verifyToken } = require('../middleware/auth');
const { Op } = require('sequelize');

// Get all alerts for the user
router.get('/', verifyToken, async (req, res) => {
  try {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const alerts = await Alert.findAll({
      where: {
        userId: req.user.id,
        [Op.or]: [
          { isTriggered: false },
          { 
            isTriggered: true,
            triggeredAt: { [Op.gte]: twoMonthsAgo }
          }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      alerts
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching alerts',
      error: error.message
    });
  }
});

// Create a new alert
router.post('/', verifyToken, async (req, res) => {
  try {
    const { coinId, symbol, targetPrice, condition } = req.body;

    if (!coinId || !symbol || !targetPrice || !condition) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const alert = await Alert.create({
      userId: req.user.id,
      coinId,
      symbol,
      targetPrice,
      condition
    });

    return res.status(201).json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Create alert error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating alert',
      error: error.message
    });
  }
});

// Mark alert as triggered or read
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isTriggered, isRead } = req.body;

    const alert = await Alert.findOne({
      where: { id, userId: req.user.id }
    });

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    if (isTriggered !== undefined && isTriggered && !alert.isTriggered) {
      alert.isTriggered = true;
      alert.triggeredAt = new Date();
    }
    
    if (isRead !== undefined) {
      alert.isRead = isRead;
    }

    await alert.save();

    return res.status(200).json({
      success: true,
      alert
    });
  } catch (error) {
    console.error('Update alert error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating alert',
      error: error.message
    });
  }
});

// Delete an alert
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Alert.destroy({
      where: { id, userId: req.user.id }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Alert deleted'
    });
  } catch (error) {
    console.error('Delete alert error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting alert',
      error: error.message
    });
  }
});

// Mark all as read
router.post('/mark-all-read', verifyToken, async (req, res) => {
  try {
    await Alert.update(
      { isRead: true },
      { 
        where: { 
          userId: req.user.id,
          isTriggered: true,
          isRead: false
        } 
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating alerts',
      error: error.message
    });
  }
});

module.exports = router;

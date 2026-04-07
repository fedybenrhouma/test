const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { planId } = req.body;
    
    const plans = {
      'pro-1m': { name: 'Pro Plan - 1 Month', price: 2000, days: 30 },
      'pro-3m': { name: 'Pro Plan - 3 Months', price: 5000, days: 90 },
      'pro-6m': { name: 'Pro Plan - 6 Months', price: 9000, days: 180 },
      'pro-1y': { name: 'Pro Plan - 1 Year', price: 15000, days: 365 },
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: 'Access to advanced trading agents and real-time portfolio tracking.',
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/profile?tab=plans&payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/products?payment=cancelled`,
      metadata: {
        userId: req.user.id,
        planId: planId,
        planName: plan.name,
        days: plan.days,
        amount: (plan.price / 100).toString()
      }
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ success: false, message: 'Could not initiate payment' });
  }
});

// GET /api/payments/subscriptions - Fetch user's subscription history
router.get('/subscriptions', verifyToken, async (req, res) => {
  try {
    const subscriptions = await Subscription.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, subscriptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/cancel-subscription
router.post('/cancel-subscription', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.isPro) {
      return res.status(400).json({ success: false, message: 'No active pro plan found' });
    }

    // Find all active subscriptions for this user, ordered by endDate descending
    const activeSubs = await Subscription.findAll({
      where: { userId: req.user.id, status: 'active' },
      order: [['endDate', 'DESC']]
    });

    if (activeSubs.length === 0) {
      // Fallback if user isPro but no records found
      await user.update({
        isPro: false,
        proExpiry: new Date()
      });
      return res.json({ success: true, message: 'No active subscription records found. Status reset.' });
    }

    // Mark the latest subscription as cancelled
    const latestSub = activeSubs[0];
    await latestSub.update({ status: 'cancelled' });

    // Determine new expiry date
    // If there's another active sub, use its endDate. Otherwise, expire now.
    let newExpiry = new Date();
    if (activeSubs.length > 1) {
      newExpiry = activeSubs[1].endDate;
    }

    const now = new Date();
    const stillPro = newExpiry > now;

    // Update user status
    await user.update({
      isPro: stillPro,
      proExpiry: newExpiry
    });

    res.json({ 
      success: true, 
      message: activeSubs.length > 1 
        ? `Latest subscription cancelled. You are still PRO until ${newExpiry.toLocaleDateString()}.` 
        : 'Subscription cancelled successfully.',
      isPro: stillPro,
      proExpiry: newExpiry
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payments/test-upgrade?userId=...
router.get('/test-upgrade', async (req, res) => {
  try {
    const { userId, planId = 'pro-1y' } = req.query;
    if (!userId) return res.status(400).send('Missing userId');

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send('User not found');

    const plans = {
      'pro-1m': { name: 'Pro Plan - 1 Month', days: 30, amount: 20.00 },
      'pro-1y': { name: 'Pro Plan - 1 Year', days: 365, amount: 150.00 },
    };

    const plan = plans[planId] || plans['pro-1y'];
    
    const now = new Date();
    const currentExpiry = user.proExpiry && user.proExpiry > now ? new Date(user.proExpiry) : now;
    const newExpiry = new Date(currentExpiry.getTime() + plan.days * 24 * 60 * 60 * 1000);

    await user.update({
      isPro: true,
      proExpiry: newExpiry
    });

    // Also create a record in Subscription model
    await Subscription.create({
      userId: user.id,
      planId: planId,
      planName: `${plan.name} (Test)`,
      amount: plan.amount,
      status: 'active',
      startDate: now,
      endDate: newExpiry
    });

    res.send(`Success! User ${user.email} is now PRO until ${newExpiry.toLocaleDateString()}. Record created in Subscriptions table.`);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Stripe Webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const userId = session.metadata.userId;
    const days = parseInt(session.metadata.days);
    const planId = session.metadata.planId;
    const planName = session.metadata.planName;
    const amount = parseFloat(session.metadata.amount);
    const stripeCustomerId = session.customer;

    try {
      const user = await User.findByPk(userId);
      if (user) {
        const now = new Date();
        const currentExpiry = user.proExpiry && user.proExpiry > now ? new Date(user.proExpiry) : now;
        const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);

        await user.update({
          isPro: true,
          proExpiry: newExpiry,
          stripeCustomerId: stripeCustomerId
        });

        // Create Subscription Record
        await Subscription.create({
          userId,
          stripeSessionId: session.id,
          planId,
          planName,
          amount,
          status: 'active',
          startDate: now,
          endDate: newExpiry
        });
        
        console.log(`Subscription record created for user ${userId}`);
      }
    } catch (dbErr) {
      console.error('Database update failed during webhook:', dbErr);
      return res.status(500).json({ received: false });
    }
  }

  res.json({ received: true });
});

module.exports = router;

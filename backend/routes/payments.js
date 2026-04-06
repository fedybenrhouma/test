const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');

// POST /api/payments/create-checkout-session
// This route will use the global express.json() parser from server.js
router.post('/create-checkout-session', verifyToken, async (req, res) => {
  try {
    const { planId } = req.body;
    
    // Define plans
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
      success_url: `${process.env.FRONTEND_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/products?payment=cancelled`,
      metadata: {
        userId: req.user.id,
        planId: planId,
        days: plan.days
      }
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ success: false, message: 'Could not initiate payment' });
  }
});

// GET /api/payments/test-upgrade?userId=...
// TEMP: Only for testing without webhooks!
router.get('/test-upgrade', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).send('Missing userId');

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send('User not found');

    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    await user.update({
      isPro: true,
      proExpiry: oneYear
    });

    res.send(`Success! User ${user.email} is now PRO until ${oneYear.toLocaleDateString()}. Refresh your frontend.`);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Stripe Webhook handler
// Note: server.js already applies express.raw() to /api/payments/webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // This is the raw buffer from express.raw()
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Fulfill the purchase
    const userId = session.metadata.userId;
    const days = parseInt(session.metadata.days);
    const stripeCustomerId = session.customer;

    try {
      const user = await User.findByPk(userId);
      if (user) {
        // Calculate new expiry date
        const now = new Date();
        const currentExpiry = user.proExpiry && user.proExpiry > now ? new Date(user.proExpiry) : now;
        const newExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);

        await user.update({
          isPro: true,
          proExpiry: newExpiry,
          stripeCustomerId: stripeCustomerId
        });
        
        console.log(`User ${userId} upgraded to Pro until ${newExpiry}`);
      }
    } catch (dbErr) {
      console.error('Database update failed during webhook:', dbErr);
      // We return 500 so Stripe retries later
      return res.status(500).json({ received: false });
    }
  }

  res.json({ received: true });
});

module.exports = router;

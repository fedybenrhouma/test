const express = require('express');
const router = express.Router();
const axios = require('axios');
const redis = require('../config/redis');
const { verifyToken } = require('../middleware/auth');

// Retry helper with exponential backoff
async function fetchWithRetry(url, config, maxRetries = 5) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, config);
      return response;
    } catch (error) {
      lastError = error;
      if (error.response?.status === 429) {
        const delay = Math.min(1000 * Math.pow(2, attempt + 1), 15000);
        console.log(`Rate limited (429), retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (error.response?.status >= 500) {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`Server error (${error.response.status}), retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// Get all top 250 cryptocurrency markets (cached, no pagination)
router.get('/markets', verifyToken, async (req, res) => {
  try {
    const cacheKey = 'markets_all_250';

    // Try to get from cache
    console.log('Checking Redis cache for all markets...');
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('Cache hit! Returning 250 coins from cache');
        return res.json({
          success: true,
          message: 'Markets data (from cache)',
          data: JSON.parse(cached),
        });
      }
    } catch (cacheErr) {
      console.warn('Cache check failed (Redis may not be running):', cacheErr.message);
    }

    console.log('Cache miss for all markets - fetching all 250 coins from CoinGecko...');

    // Fetch ALL 250 coins at once from CoinGecko API
    const { data } = await fetchWithRetry(
      'https://api.coingecko.com/api/v3/coins/markets',
      {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 250,  // Fetch all 250 at once
          page: 1,
          price_change_percentage: '1h,24h,7d',
          sparkline: false,
        },
        timeout: 15000,  // Increased timeout for larger request
      },
      5
    );

    console.log(`Successfully fetched ${data.length} coins from CoinGecko`);

    // Try to cache (non-blocking if Redis fails)
    // Cache for 5 minutes to reduce API calls
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(data));
      console.log('All 250 markets cached for 300 seconds');
    } catch (cacheErr) {
      console.warn('Failed to cache markets (Redis may not be running):', cacheErr.message);
    }

    res.json({
      success: true,
      message: 'Markets data (all 250 coins)',
      data,
    });
  } catch (error) {
    console.error('Error fetching markets:', error.message);

    if (error.response?.status === 429) {
      console.warn('Rate limited by CoinGecko API');
      return res.status(429).json({
        success: false,
        message: 'Rate limited by CoinGecko API - please try again in a few seconds',
        error: 'Rate limit reached (429)',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching cryptocurrency markets',
      error: error.message,
    });
  }
});

// Get specific coin details
router.get('/markets/:coinId', verifyToken, async (req, res) => {
  try {
    const { coinId } = req.params;
    const cacheKey = `coin_${coinId}`;

    // Try to get from cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('Cache hit for coin:', coinId);
        return res.json({
          success: true,
          message: 'Coin data (from cache)',
          data: JSON.parse(cached),
        });
      }
    } catch (cacheErr) {
      console.warn('Cache check failed (Redis may not be running):', cacheErr.message);
    }

    console.log('Fetching coin details from CoinGecko:', coinId);

    // Fetch from CoinGecko API
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}`,
      {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
        },
        timeout: 10000,
      }
    );

    // Try to cache (non-blocking if Redis fails)
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(data));
    } catch (cacheErr) {
      console.warn('Failed to cache coin data (Redis may not be running):', cacheErr.message);
    }

    res.json({
      success: true,
      message: 'Coin data',
      data,
    });
  } catch (error) {
    console.error('Error fetching coin details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error fetching coin details',
      error: error.message,
    });
  }
});

module.exports = router;

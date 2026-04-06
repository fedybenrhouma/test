const express = require('express');
const router = express.Router();
const ccxt = require('ccxt');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const User = require('../models/User');
const redis = require('../config/redis');

// POST /api/binance/connect (protected)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'Please provide both API Key and API Secret.' });
    }

    // Test keys
    const exchange = new ccxt.binance({ apiKey, secret: apiSecret });
    try {
      await exchange.fetchBalance();
    } catch (error) {
      console.error('Binance connection test failed:', error.message);
      return res.status(400).json({ success: false, error: 'Invalid Binance keys. Check and try again.' });
    }

    // Check futures
    let futuresEnabled = false;
    try {
      await exchange.fetchBalance({ type: 'future' });
      futuresEnabled = true;
    } catch (error) {
      futuresEnabled = false;
    }

    // Encrypt and save to user
    const user = await User.findByPk(req.user.id);
    await user.update({
      binanceApiKey: encrypt(apiKey),
      binanceApiSecret: encrypt(apiSecret),
      binanceConnectedAt: new Date()
    });

    return res.json({
      success: true,
      futuresEnabled,
      connectedAt: new Date(),
      maskedKey: apiKey.substring(0, 8) + '••••••••••••••••'
    });

  } catch (error) {
    console.error('Connect Binance Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/binance/test (protected)
router.post('/test', verifyToken, async (req, res) => {
  try {
    const { apiKey, apiSecret } = req.body;

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ success: false, message: 'Please provide both API Key and API Secret.' });
    }

    const exchange = new ccxt.binance({ apiKey, secret: apiSecret });
    try {
      await exchange.fetchBalance();
    } catch (error) {
      return res.json({ valid: false, message: 'Invalid keys: ' + error.message });
    }

    // Check futures
    let futuresEnabled = false;
    try {
      await exchange.fetchBalance({ type: 'future' });
      futuresEnabled = true;
    } catch (error) {
      futuresEnabled = false;
    }

    return res.json({ valid: true, futuresEnabled });

  } catch (error) {
    console.error('Test Binance Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/binance/status (protected)
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.hasBinanceConnected()) {
      return res.json({ connected: false });
    }

    // Test live with ccxt if connected
    const exchange = new ccxt.binance({
      apiKey: decrypt(user.binanceApiKey),
      secret: decrypt(user.binanceApiSecret)
    });

    let futuresEnabled = false;
    try {
      await exchange.fetchBalance({ type: 'future' });
      futuresEnabled = true;
    } catch (error) {
      futuresEnabled = false;
    }

    return res.json({
      connected: true,
      maskedKey: user.getMaskedApiKey(),
      connectedAt: user.binanceConnectedAt,
      futuresEnabled
    });

  } catch (error) {
    console.error('Get Binance Status Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/binance/disconnect (protected)
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    await user.update({
      binanceApiKey: null,
      binanceApiSecret: null,
      binanceConnectedAt: null
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('Disconnect Binance Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/binance/portfolio (protected)
router.get('/portfolio', verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.hasBinanceConnected()) {
      return res.status(400).json({ success: false, message: 'Binance account not connected' });
    }

    const exchange = new ccxt.binance({
      apiKey: decrypt(user.binanceApiKey),
      secret: decrypt(user.binanceApiSecret)
    });

    // 1. Fetch Spot Balance
    const balance = await exchange.fetchBalance();
    const totalBalances = balance.total;

    // Filter non-zero balances and format them
    let rawHoldings = Object.keys(totalBalances)
      .filter(symbol => totalBalances[symbol] > 0)
      .map(symbol => {
        // Normalize symbol (e.g., LDUSDT -> USDT for earn assets)
        let normalizedSymbol = symbol;
        if (symbol.startsWith('LD')) normalizedSymbol = symbol.substring(2);
        
        return {
          symbol: normalizedSymbol,
          originalSymbol: symbol,
          amount: totalBalances[symbol]
        };
      });

    // 2. Fetch Market Prices (from cache or live)
    let marketData = [];
    try {
      const cached = await redis.get('markets_all_250');
      if (cached) {
        marketData = JSON.parse(cached);
      } else {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 250,
            page: 1,
            price_change_percentage: '24h'
          }
        });
        marketData = response.data;
        await redis.setEx('markets_all_250', 300, JSON.stringify(marketData));
      }
    } catch (err) {
      console.warn('Market data fetch error:', err.message);
    }

    // 3. Map holdings to market data
    let totalValueUsd = 0;
    let enrichedHoldings = rawHoldings.map(holding => {
      const marketInfo = marketData.find(m => m.symbol.toLowerCase() === holding.symbol.toLowerCase());
      
      let price = marketInfo ? marketInfo.current_price : 0;
      
      // Fallback for common stablecoins
      const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD', 'USDS', 'USDP'];
      if (price === 0 && stablecoins.includes(holding.symbol.toUpperCase())) {
        price = 1.0;
      }

      const value = holding.amount * price;
      
      return {
        ...holding,
        name: marketInfo ? marketInfo.name : holding.symbol,
        image: marketInfo ? marketInfo.image : null,
        currentPrice: price,
        value: value,
        priceChangePercentage24h: marketInfo ? marketInfo.price_change_percentage_24h : 0,
        priceUnknown: price === 0
      };
    });

    // 4. Calculate total values
    totalValueUsd = enrichedHoldings.reduce((sum, h) => sum + h.value, 0);

    let totalChange24hUsd = 0;
    enrichedHoldings.forEach(h => {
      if (h.currentPrice > 0 && h.priceChangePercentage24h !== 0) {
        const prevPrice = h.currentPrice / (1 + (h.priceChangePercentage24h / 100));
        totalChange24hUsd += (h.currentPrice - prevPrice) * h.amount;
      }
    });

    const totalChangePercentage24h = (totalValueUsd - totalChange24hUsd) > 0 
      ? (totalChange24hUsd / (totalValueUsd - totalChange24hUsd)) * 100 
      : 0;

    // 5. Sort by value descending, then by amount for unknowns
    enrichedHoldings.sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return b.amount - a.amount;
    });

    return res.json({
      success: true,
      data: {
        totalValueUsd,
        totalChange24hUsd,
        totalChangePercentage24h,
        holdings: enrichedHoldings
      }
    });

  } catch (error) {
    console.error('Binance Portfolio Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch Binance portfolio' });
  }
});

module.exports = router;

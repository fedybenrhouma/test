require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const redis = require('./config/redis');
const User = require('./models/User');
const Watchlist = require('./models/Watchlist');
const Alert = require('./models/Alert');
const UserExchangeKey = require('./models/UserExchangeKey');
const Subscription = require('./models/Subscription');
const DebateCycle = require('./models/DebateCycle');
const DebateMessage = require('./models/DebateMessage');
const Trade = require('./models/Trade');
const { spawn } = require('child_process');
const path = require('path');
const { startRealtimeMonitor } = require('./services/tradeMonitor');

// Define relationships
User.hasMany(Watchlist, { foreignKey: 'userId', as: 'watchlist' });
Watchlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Alert, { foreignKey: 'userId', as: 'alerts' });
Alert.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Subscription, { foreignKey: 'userId', as: 'subscriptions' });
Subscription.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(DebateCycle, { foreignKey: 'user_id', as: 'debateCycles' });
DebateCycle.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

DebateCycle.hasMany(DebateMessage, { foreignKey: 'cycle_id', sourceKey: 'cycle_id', as: 'messages' });
DebateMessage.belongsTo(DebateCycle, { foreignKey: 'cycle_id', targetKey: 'cycle_id', as: 'cycle' });

User.hasMany(Trade, { foreignKey: 'user_id', as: 'trades' });
Trade.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// IMPORTANT: Webhook route must come BEFORE express.json() 
// because it needs the raw body for signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./routes/payments'));

// Global parsers for all other routes
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Express server is running' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/crypto', require('./routes/markets'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/binance', require('./routes/binance'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/trades', require('./routes/trades'));
// Note: /api/payments/webhook is already handled above, 
// but other payment routes (like create-checkout-session) need express.json()
app.use('/api/payments', require('./routes/payments'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Initialize Socket.io
const io = require('./services/socket').init(server);

// Database Connection and Sync (non-blocking)
sequelize
  .authenticate()
  .then(() => {
    console.log('PostgreSQL connected successfully');
    // Enable pgvector extension
    return sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
  })
  .then(() => {
    console.log('pgvector extension enabled');
    // Sync models with database
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log(' Database models synced');

    // Start Instant Node.js Trade Monitor
    startRealtimeMonitor();

    // Start Data Collector Daemon
    const pythonPath = path.join(__dirname, '../agents/venv/Scripts/python.exe');
    const collectorScriptPath = path.join(__dirname, '../agents/collect_data.py');
    console.log(' Starting Background Data Collector...');
    const collectorProcess = spawn(pythonPath, [collectorScriptPath], {
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '../agents')
      },
      cwd: path.join(__dirname, '../agents')
    });

    collectorProcess.stdout.on('data', (data) => {
      console.log(`[Data Collector]: ${data.toString().trim()}`);
    });

    collectorProcess.stderr.on('data', (data) => {
      console.error(`[Data Collector Error]: ${data.toString().trim()}`);
    });

    // Start ML Auto-Retrain Daemon
    const retrainScriptPath = path.join(__dirname, '../agents/auto_retrain.py');
    console.log(' Starting Background ML Auto-Retrainer...');
    const retrainProcess = spawn(pythonPath, [retrainScriptPath], {
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '../agents')
      },
      cwd: path.join(__dirname, '../agents')
    });

    retrainProcess.stdout.on('data', (data) => {
      console.log(`[ML Retrainer]: ${data.toString().trim()}`);
    });

    retrainProcess.stderr.on('data', (data) => {
      console.error(`[ML Retrainer Error]: ${data.toString().trim()}`);
    });
  })
  .catch((error) => {
    console.error('✗ Database connection error:', error.message);
    console.error('Make sure PostgreSQL is running and credentials in .env are correct');
  });
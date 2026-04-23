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

// Database Connection and Sync (non-blocking)
sequelize
  .authenticate()
  .then(() => {
    console.log('✓ PostgreSQL connected successfully');
    // Sync models with database
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    console.log('✓ Database models synced');

    // Start Monitor Agent Daemon
    const pythonPath = path.join(__dirname, '../agents/venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../agents/agents_nodes/monitor_agent.py');
    
    console.log('🚀 Starting Background Monitor Agent...');
    const monitorProcess = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '../agents')
      },
      cwd: path.join(__dirname, '../agents')
    });

    monitorProcess.stdout.on('data', (data) => {
      console.log(`[Monitor Agent]: ${data.toString().trim()}`);
    });

    monitorProcess.stderr.on('data', (data) => {
      console.error(`[Monitor Agent Error]: ${data.toString().trim()}`);
    });
  })
  .catch((error) => {
    console.error('✗ Database connection error:', error.message);
    console.error('Make sure PostgreSQL is running and credentials in .env are correct');
  });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
const redis = require('./config/redis');
const User = require('./models/User');
const Watchlist = require('./models/Watchlist');
const Alert = require('./models/Alert');

// Define relationships
User.hasMany(Watchlist, { foreignKey: 'userId', as: 'watchlist' });
Watchlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Alert, { foreignKey: 'userId', as: 'alerts' });
Alert.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
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
  })
  .catch((error) => {
    console.error('✗ Database connection error:', error.message);
    console.error('Make sure PostgreSQL is running and credentials in .env are correct');
  });
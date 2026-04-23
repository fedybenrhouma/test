const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  cycle_id: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  asset: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  direction: {
    type: DataTypes.STRING(10),
    allowNull: false // 'long' or 'short'
  },
  entry_price: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false
  },
  stop_loss: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false
  },
  take_profit: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false
  },
  position_size: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false
  },
  leverage: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  order_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'open' // 'open', 'closed'
  },
  close_reason: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  close_price: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  pnl: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'trades',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Trade;

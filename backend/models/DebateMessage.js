const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DebateMessage = sequelize.define('DebateMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cycle_id: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  agent_name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  signal: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  confidence: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'debate_messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = DebateMessage;

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DebateCycle = sequelize.define('DebateCycle', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  cycle_id: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  asset: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  timeframe: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  recommendation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending' // 'pending', 'completed'
  }
}, {
  tableName: 'debate_cycles',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = DebateCycle;

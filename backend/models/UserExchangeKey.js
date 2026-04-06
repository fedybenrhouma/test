const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserExchangeKey = sequelize.define('UserExchangeKey', {
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  userId: { 
    type: DataTypes.UUID, 
    allowNull: false 
  },
  exchange: { 
    type: DataTypes.STRING, 
    defaultValue: 'binance' 
  },
  apiKey: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },      // encrypted
  apiSecret: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },   // encrypted
  oauthToken: { 
    type: DataTypes.STRING 
  },                    // encrypted
  oauthRefresh: { 
    type: DataTypes.STRING 
  },                  // encrypted
  oauthExpires: { 
    type: DataTypes.DATE 
  },
  connectedAt: { 
    type: DataTypes.DATE, 
    defaultValue: DataTypes.NOW 
  }
}, {
  timestamps: false,
  indexes: [{ unique: true, fields: ['userId', 'exchange'] }]
});

module.exports = UserExchangeKey;

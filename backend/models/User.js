const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');
const { decrypt } = require('../utils/crypto');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      lowercase: true,
      validate: {
        isEmail: {
          msg: 'Please provide a valid email',
        },
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: {
          args: [3, 30],
          msg: 'Username must be between 3 and 30 characters',
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [6, Infinity],
          msg: 'Password must be at least 6 characters',
        },
      },
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [2, Infinity],
          msg: 'First name must be at least 2 characters',
        },
      },
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [2, Infinity],
          msg: 'Last name must be at least 2 characters',
        },
      },
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    binanceApiKey: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    binanceApiSecret: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    binanceConnectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    isPro: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    proExpiry: {
      type: DataTypes.DATE,
      allowNull: true
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user'
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    banReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    banExpires: {
      type: DataTypes.DATE,
      allowNull: true
    }
    },  {
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

// Method to compare passwords
User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
User.prototype.getPublicProfile = function () {
  const user = this.toJSON();
  delete user.password;
  delete user.binanceApiKey;
  delete user.binanceApiSecret;
  user.isProActive = this.isProActive();
  return user;
};

User.prototype.isProActive = function () {
  if (!this.isPro) return false;
  if (!this.proExpiry) return true; // Lifetime or unset
  return new Date() < new Date(this.proExpiry);
};

User.prototype.hasBinanceConnected = function() {
  return !!this.binanceApiKey
}

User.prototype.getMaskedApiKey = function() {
  if (!this.binanceApiKey) return null
  try {
    const decrypted = decrypt(this.binanceApiKey);
    return decrypted.substring(0, 8) + '••••••••••••••••';
  } catch (error) {
    console.error('Error decrypting API key:', error);
    return 'Error decryption';
  }
}

// Add association
const UserExchangeKey = require('./UserExchangeKey');
User.hasOne(UserExchangeKey, { foreignKey: 'userId' });
UserExchangeKey.belongsTo(User, { foreignKey: 'userId' });

module.exports = User;

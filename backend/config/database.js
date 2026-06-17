const { Sequelize } = require('sequelize');
const pgvector = require('pgvector/sequelize');

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'account_system',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false, // Set to console.log to see SQL queries
  }
);

// Register pgvector data type
pgvector.registerType(Sequelize);

module.exports = sequelize;

const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  legacyMode: true, // Enable legacy commands like get/set
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

redisClient.on('connect', () => {
  console.log('✓ Redis connected');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
  }
})();

module.exports = redisClient;

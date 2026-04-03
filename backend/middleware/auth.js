const jwt = require('jsonwebtoken');

// Verify JWT Token
const verifyToken = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  console.log('Authorization header:', authHeader);

  const token = authHeader?.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({
      success: false,
      message: 'No token provided. Authorization denied.',
    });
  }

  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified successfully, user:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
};

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = {
  verifyToken,
  generateToken,
};

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/apiResponse');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jewelbiz_super_secret_jwt_key_2026_secure');

      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) {
        return error(res, 'User not found. Authorization denied.', 401);
      }

      if (!user.isActive) {
        return error(res, 'Account is disabled. Please contact administrator.', 403);
      }

      req.user = {
        id: user._id.toString(),
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessName: user.businessName
      };

      return next();
    } catch (err) {
      console.error('[Auth Middleware] Verification failed:', err.message);
      return error(res, 'Token is invalid or expired', 401);
    }
  }

  if (!token) {
    return error(res, 'No authentication token provided, authorization denied', 401);
  }
};

module.exports = {
  protect
};

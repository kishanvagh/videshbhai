const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { success, error } = require('../utils/apiResponse');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), email: user.email },
    process.env.JWT_SECRET || 'jewelbiz_super_secret_jwt_key_2026_secure',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    // Private system: prevent strangers from creating accounts on a deployed
    // site. Local development always allows it; production only allows it if
    // ALLOW_REGISTRATION=true is explicitly set.
    const allowRegistration =
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_REGISTRATION === 'true';
    if (!allowRegistration) {
      return error(res, 'Registration is disabled. Please use the account provided by the administrator.', 403);
    }

    const { name, email, password, businessName, role } = req.body;

    if (!name || !email || !password) {
      return error(res, 'Please provide name, email and password', 400);
    }

    if (password.length < 6) {
      return error(res, 'Password must be at least 6 characters long', 400);
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return error(res, 'An account with this email already exists', 409);
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password, // will be hashed by pre-save hook
      businessName: businessName ? businessName.trim() : 'My Jewelry Business',
      role: role || 'owner'
    });

    const token = generateToken(user);

    return success(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessName: user.businessName
      }
    }, 'User registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Please provide email and password', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return error(res, 'Invalid credentials', 401);
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return error(res, 'Invalid credentials', 401);
    }

    if (!user.isActive) {
      return error(res, 'Account is deactivated. Please contact support.', 403);
    }

    const token = generateToken(user);

    return success(res, {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        businessName: user.businessName
      }
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, { user }, 'Current user profile fetched successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    if (req.body.name) user.name = req.body.name.trim();
    if (req.body.businessName) user.businessName = req.body.businessName.trim();
    await user.save();
    return success(res, { user: { id: user._id, name: user.name, email: user.email, businessName: user.businessName } }, 'Profile updated');
  } catch (err) { next(err); }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return error(res, 'User not found', 404);
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) return error(res, 'Current password is incorrect', 401);
    if (!newPassword || newPassword.length < 6) return error(res, 'New password must be at least 6 characters', 400);
    user.passwordHash = newPassword;
    await user.save();
    return success(res, {}, 'Password changed successfully');
  } catch (err) { next(err); }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
};

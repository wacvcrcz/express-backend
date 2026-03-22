const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new user
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Create user
    const user = new User({
      username,
      email,
      passwordHash: password,
      profile: {
        displayName: username,
        status: 'offline'
      }
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Error registering user'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update user status to online
    user.profile.status = 'online';
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging in'
    });
  }
};

// Get current user profile
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching profile'
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { profile } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update profile fields
    if (profile.displayName) {
      user.profile.displayName = profile.displayName;
    }
    if (profile.avatar !== undefined) {
      user.profile.avatar = profile.avatar;
    }
    if (profile.bio !== undefined) {
      user.profile.bio = profile.bio;
    }

    await user.save();

    res.json({
      success: true,
      data: {
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating profile'
    });
  }
};

// Register device
exports.registerDevice = async (req, res) => {
  try {
    const { deviceId, platform, pushToken } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Add or update device
    const existingDeviceIndex = user.devices.findIndex(
      d => d.deviceId === deviceId
    );

    const deviceData = {
      deviceId,
      platform,
      pushToken,
      lastActive: new Date()
    };

    if (existingDeviceIndex >= 0) {
      user.devices[existingDeviceIndex] = deviceData;
    } else {
      user.devices.push(deviceData);
    }

    await user.save();

    res.status(201).json({
      success: true,
      data: {
        deviceId,
        platform,
        registered: true
      }
    });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      error: 'Error registering device'
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-passwordHash -devices');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching user'
    });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user) {
      user.profile.status = 'offline';
      await user.save();
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Error logging out'
    });
  }
};
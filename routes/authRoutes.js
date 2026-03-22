const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('profile.displayName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Display name must be less than 50 characters'),
  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
];

// Public routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);

// Protected routes
router.get('/me', authMiddleware, authController.getMe);
router.patch('/me', authMiddleware, updateProfileValidation, authController.updateProfile);
router.post('/me/devices', authMiddleware, authController.registerDevice);
router.get('/users/:userId', authMiddleware, authController.getUserById);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
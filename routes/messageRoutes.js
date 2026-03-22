const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const sendMessageValidation = [
  body('content.type')
    .isIn(['text', 'image', 'video', 'audio', 'file'])
    .withMessage('Invalid content type'),
  body('content.text')
    .if(body('content.type').equals('text'))
    .trim()
    .notEmpty()
    .withMessage('Message text is required')
    .isLength({ max: 10000 })
    .withMessage('Message must be less than 10,000 characters'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid replyTo ID')
];

const markAsReadValidation = [
  body('roomId')
    .notEmpty()
    .withMessage('Room ID is required'),
  body('messageId')
    .notEmpty()
    .withMessage('Message ID is required')
];

const addReactionValidation = [
  body('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
];

// All routes are protected
router.use(authMiddleware);

// Message routes
router.get('/:roomId/messages', messageController.getMessages);
router.post('/:roomId/messages', sendMessageValidation, messageController.sendMessage);
router.post('/mark-read', markAsReadValidation, messageController.markAsRead);

// Reaction routes
router.post('/messages/:messageId/reactions', addReactionValidation, messageController.addReaction);
router.delete('/messages/:messageId/reactions/:emoji', messageController.removeReaction);

// Delete message
router.delete('/messages/:messageId', messageController.deleteMessage);

module.exports = router;
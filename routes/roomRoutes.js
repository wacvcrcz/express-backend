const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/auth');
const { body } = require('express-validator');

// Validation rules
const createRoomValidation = [
  body('type')
    .optional()
    .isIn(['private', 'group'])
    .withMessage('Type must be either private or group'),
  body('groupSettings.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Group name must be less than 100 characters'),
  body('participants')
    .optional()
    .isArray()
    .withMessage('Participants must be an array')
];

const addParticipantValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required'),
  body('role')
    .optional()
    .isIn(['admin', 'member'])
    .withMessage('Role must be either admin or member')
];

const createPrivateChatValidation = [
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
];

// All routes are protected
router.use(authMiddleware);

// Room routes
router.post('/', createRoomValidation, roomController.createRoom);
router.get('/', roomController.getRooms);
router.get('/:roomId', roomController.getRoomById);
router.post('/private', createPrivateChatValidation, roomController.createPrivateChat);

// Participant management
router.post('/:roomId/participants', addParticipantValidation, roomController.addParticipant);
router.delete('/:roomId/participants/:userId', roomController.removeParticipant);
router.post('/:roomId/leave', roomController.leaveRoom);

module.exports = router;
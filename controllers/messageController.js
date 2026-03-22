const Message = require('../models/Message');
const Room = require('../models/Room');
const { validationResult } = require('express-validator');

// Get messages for a room
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    // Check if user is in room
    const room = await Room.findById(roomId);
    if (!room || !room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this room'
      });
    }

    // Build query
    const query = { roomId };
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username profile.displayName profile.avatar')
      .populate('replyTo', 'content senderId')
      .populate('reactions.userId', 'username profile.displayName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Get cursor for pagination
    const hasMore = messages.length === parseInt(limit);
    const nextCursor = hasMore ? messages[messages.length - 1]._id : null;

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          limit: parseInt(limit),
          hasMore,
          nextCursor
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching messages'
    });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { roomId } = req.params;
    const { content, replyTo } = req.body;

    // Check if user is in room
    const room = await Room.findById(roomId);
    if (!room || !room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to send messages in this room'
      });
    }

    // Check ephemeral settings
    const isEphemeral = room.ephemeralSettings && room.ephemeralSettings.enabled;
    const ephemeralExpiresAt = isEphemeral
      ? new Date(Date.now() + room.ephemeralSettings.ttlSeconds * 1000)
      : null;

    // Create message
    const message = new Message({
      roomId,
      senderId: req.userId,
      content,
      replyTo,
      isEphemeral,
      ephemeralExpiresAt
    });

    await message.save();
    await message.populate('senderId', 'username profile.displayName profile.avatar');

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Error sending message'
    });
  }
};

// Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const { roomId, messageId } = req.body;

    // Check if user is in room
    const room = await Room.findById(roomId);
    if (!room || !room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Get message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Mark as read
    await message.markAsRead(req.userId);

    // Update user's lastReadAt for room
    const participant = room.participants.find(
      p => p.userId.toString() === req.userId.toString()
    );
    if (participant) {
      participant.lastReadAt = new Date();
      await room.save();
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Error marking message as read'
    });
  }
};

// Add reaction to message
exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is in room
    const room = await Room.findById(message.roomId);
    if (!room || !room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Add or update reaction
    await message.addReaction(req.userId, emoji);

    res.status(201).json({
      success: true,
      data: {
        userId: req.userId,
        emoji,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding reaction'
    });
  }
};

// Remove reaction from message
exports.removeReaction = async (req, res) => {
  try {
    const { messageId, emoji } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is in room
    const room = await Room.findById(message.roomId);
    if (!room || !room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Remove reaction
    message.reactions = message.reactions.filter(
      r => !(r.userId.toString() === req.userId.toString() && r.emoji === emoji)
    );

    await message.save();

    res.json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Error removing reaction'
    });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is sender or room admin
    const isSender = message.senderId.toString() === req.userId.toString();
    const room = await Room.findById(message.roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    const participant = room.participants.find(
      p => p.userId.toString() === req.userId.toString()
    );

    if (!isSender && (!participant || participant.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this message'
      });
    }

    // Delete message
    await Message.findByIdAndDelete(messageId);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting message'
    });
  }
};
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Create a new room
exports.createRoom = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { type, groupSettings, participants, ephemeralSettings } = req.body;

    // Create room
    const room = new Room({
      type: type || 'private',
      createdBy: req.userId,
      participants: [
        {
          userId: req.userId,
          role: 'admin',
          joinedAt: new Date()
        },
        ...(participants || []).map(p => ({
          userId: p.userId,
          role: p.role || 'member'
        }))
      ],
      groupSettings: groupSettings || {},
      ephemeralSettings: ephemeralSettings || { enabled: false, ttlSeconds: 300 }
    });

    await room.save();

    // Populate participant details
    await room.populate('participants.userId', 'username profile.displayName profile.avatar profile.status');

    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating room'
    });
  }
};

// Get all rooms for user
exports.getRooms = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const rooms = await Room.find({
      'participants.userId': req.userId
    })
      .populate('participants.userId', 'username profile.displayName profile.avatar profile.status')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get last message for each room
    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await Message.findOne({ roomId: room._id })
          .populate('senderId', 'username profile.displayName profile.avatar')
          .sort({ createdAt: -1 });

        // Count unread messages
        const userId = req.userId;
        const participant = room.participants.find(
          p => p.userId.toString() === userId.toString()
        );

        const unreadCount = participant
          ? await Message.countDocuments({
              roomId: room._id,
              createdAt: { $gt: participant.lastReadAt || 0 },
              senderId: { $ne: userId }
            })
          : 0;

        return {
          ...room.toObject(),
          lastMessage,
          unreadCount
        };
      })
    );

    const total = await Room.countDocuments({
      'participants.userId': req.userId
    });

    res.json({
      success: true,
      data: {
        rooms: roomsWithLastMessage,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching rooms'
    });
  }
};

// Get room by ID
exports.getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
      .populate('participants.userId', 'username profile.displayName profile.avatar profile.status');

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Check if user is in room
    if (!room.hasParticipant(req.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this room'
      });
    }

    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching room'
    });
  }
};

// Add participant to room
exports.addParticipant = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, role = 'member' } = req.body;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Check if user is admin
    const requester = room.participants.find(
      p => p.userId.toString() === req.userId.toString()
    );
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can add participants'
      });
    }

    // Check if user already in room
    if (room.hasParticipant(userId)) {
      return res.status(400).json({
        success: false,
        error: 'User already in room'
      });
    }

    // Add participant
    room.participants.push({
      userId,
      role,
      joinedAt: new Date()
    });

    await room.save();
    await room.populate('participants.userId', 'username profile.displayName profile.avatar');

    const newParticipant = room.participants[room.participants.length - 1];

    res.status(201).json({
      success: true,
      data: newParticipant
    });
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding participant'
    });
  }
};

// Remove participant from room
exports.removeParticipant = async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Check if user is admin or removing themselves
    const requester = room.participants.find(
      p => p.userId.toString() === req.userId.toString()
    );
    if (!requester || (requester.role !== 'admin' && req.userId.toString() !== userId)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    // Remove participant
    room.participants = room.participants.filter(
      p => p.userId.toString() !== userId
    );

    await room.save();

    res.json({
      success: true,
      message: 'Participant removed successfully'
    });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({
      success: false,
      error: 'Error removing participant'
    });
  }
};

// Leave room
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Remove user from room
    room.participants = room.participants.filter(
      p => p.userId.toString() !== req.userId.toString()
    );

    await room.save();

    res.json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      error: 'Error leaving room'
    });
  }
};

// Create private chat room
exports.createPrivateChat = async (req, res) => {
  try {
    const { userId } = req.body;

    // Check if private chat already exists
    const existingRoom = await Room.findOne({
      type: 'private',
      'participants.userId': { $all: [req.userId, userId] },
      'participants.userId': { $size: 2 }
    });

    if (existingRoom) {
      return res.json({
        success: true,
        data: existingRoom
      });
    }

    // Create new private room
    const room = new Room({
      type: 'private',
      participants: [
        { userId: req.userId, role: 'member' },
        { userId, role: 'member' }
      ]
    });

    await room.save();
    await room.populate('participants.userId', 'username profile.displayName profile.avatar profile.status');

    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    console.error('Create private chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating private chat'
    });
  }
};
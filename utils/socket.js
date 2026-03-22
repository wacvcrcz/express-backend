const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Store connected users: { userId: Set<socketId> }
const connectedUsers = new Map();
// Store typing status: { roomId: Map<userId, timeout> }
const typingStatus = new Map();

// Socket.io connection handler
const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id;
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Track user connection
    if (!connectedUsers.has(socket.userId.toString())) {
      connectedUsers.set(socket.userId.toString(), new Set());
    }
    connectedUsers.get(socket.userId.toString()).add(socket.id);

    // Update user status to online
    try {
      await User.findByIdAndUpdate(socket.userId, {
        'profile.status': 'online'
      });
      const currentUser = await User.findById(socket.userId).select('profile');
      const currentProfile = currentUser?.profile;

      // Broadcast status to rooms
      const rooms = await Room.find({ 'participants.userId': socket.userId });
      rooms.forEach(room => {
        io.to(room._id.toString()).emit('presence:changed', {
          userId: socket.userId,
          status: 'online',
          user: {
            username: socket.username,
            profile: currentProfile
          }
        });
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }

    // Join user's rooms
    const userRooms = await Room.find({ 'participants.userId': socket.userId });
    userRooms.forEach(room => {
      socket.join(room._id.toString());
    });

    // Handle joining a specific room
    socket.on('room:join', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room || !room.hasParticipant(socket.userId)) {
          return socket.emit('error', { message: 'Not authorized to join this room' });
        }
        socket.join(roomId);
      } catch (error) {
        socket.emit('error', { message: 'Error joining room' });
      }
    });

    // Handle leaving a room
    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(roomId);
    });

    // Handle sending messages
    socket.on('message:send', async (data, callback) => {
      try {
        const { roomId, content, replyTo } = data;

        // Check if user is in room
        const room = await Room.findById(roomId);
        if (!room || !room.hasParticipant(socket.userId)) {
          return callback({ success: false, error: 'Not authorized' });
        }

        // Check ephemeral settings
        const isEphemeral = room.ephemeralSettings && room.ephemeralSettings.enabled;
        const ephemeralExpiresAt = isEphemeral
          ? new Date(Date.now() + room.ephemeralSettings.ttlSeconds * 1000)
          : null;

        // Create message
        const message = new Message({
          roomId,
          senderId: socket.userId,
          content,
          replyTo,
          isEphemeral,
          ephemeralExpiresAt
        });

        await message.save();
        await message.populate('senderId', 'username profile.displayName profile.avatar');

        // Broadcast to room (excluding sender)
        io.to(roomId).emit('message:receive', message);

        // Send delivery confirmation to sender
        socket.emit('message:delivered', {
          messageId: message._id,
          roomId,
          timestamp: new Date()
        });

        callback({ success: true, data: message });
      } catch (error) {
        console.error('Send message error:', error);
        callback({ success: false, error: 'Error sending message' });
      }
    });

    // Handle typing start
    socket.on('typing:start', async ({ roomId }) => {
      const userId = socket.userId.toString();

      // Clear existing timeout
      if (typingStatus.has(roomId) && typingStatus.get(roomId).has(userId)) {
        clearTimeout(typingStatus.get(roomId).get(userId));
      }

      // Broadcast typing status
      socket.to(roomId).emit('typing:status', {
        roomId,
        userId: socket.userId,
        isTyping: true,
        user: {
          username: socket.username
        }
      });

      // Set timeout to auto-stop
      const timeout = setTimeout(() => {
        socket.to(roomId).emit('typing:status', {
          roomId,
          userId: socket.userId,
          isTyping: false,
          user: {
            username: socket.username
          }
        });

        if (typingStatus.has(roomId)) {
          typingStatus.get(roomId).delete(userId);
        }
      }, 3000);

      if (!typingStatus.has(roomId)) {
        typingStatus.set(roomId, new Map());
      }
      typingStatus.get(roomId).set(userId, timeout);
    });

    // Handle typing stop
    socket.on('typing:stop', async ({ roomId }) => {
      const userId = socket.userId.toString();

      // Clear timeout
      if (typingStatus.has(roomId) && typingStatus.get(roomId).has(userId)) {
        clearTimeout(typingStatus.get(roomId).get(userId));
        typingStatus.get(roomId).delete(userId);
      }

      // Broadcast stop typing
      socket.to(roomId).emit('typing:status', {
        roomId,
        userId: socket.userId,
        isTyping: false,
        user: {
          username: socket.username
        }
      });
    });

    // Handle message read
    socket.on('message:read', async ({ roomId, messageId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Mark as read
        await message.markAsRead(socket.userId);

        // Update user's lastReadAt for room
        const room = await Room.findById(roomId);
        if (room) {
          const participant = room.participants.find(
            p => p.userId.toString() === socket.userId.toString()
          );
          if (participant) {
            participant.lastReadAt = new Date();
            await room.save();
          }
        }

        // Notify sender
        const currentUser = await User.findById(socket.userId).select('profile');
        io.to(roomId).emit('message:read', {
          messageId,
          readBy: socket.userId,
          timestamp: new Date(),
          user: {
            username: socket.username,
            profile: currentUser?.profile
          }
        });
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Handle presence update
    socket.on('presence:update', async ({ status }) => {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          'profile.status': status
        });
        const currentUser = await User.findById(socket.userId).select('profile');
        const currentProfile = currentUser?.profile;

        // Broadcast to user's rooms
        const rooms = await Room.find({ 'participants.userId': socket.userId });
        rooms.forEach(room => {
          io.to(room._id.toString()).emit('presence:changed', {
            userId: socket.userId,
            status,
            user: {
              username: socket.username,
              profile: currentProfile
            }
          });
        });
      } catch (error) {
        console.error('Presence update error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);

      // Remove socket from connected users
      const userId = socket.userId.toString();
      if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);

        // Check if user has no more connections
        if (connectedUsers.get(userId).size === 0) {
          connectedUsers.delete(userId);

          // Update user status to offline
          try {
            await User.findByIdAndUpdate(socket.userId, {
              'profile.status': 'offline'
            });
            const currentUser = await User.findById(socket.userId).select('profile');
            const currentProfile = currentUser?.profile;

            // Broadcast to rooms
            const rooms = await Room.find({ 'participants.userId': socket.userId });
            rooms.forEach(room => {
              io.to(room._id.toString()).emit('presence:changed', {
                userId: socket.userId,
                status: 'offline',
                user: {
                  username: socket.username,
                  profile: currentProfile
                }
              });
            });
          } catch (error) {
            console.error('Error updating user offline status:', error);
          }
        }
      }

      // Clean up typing status
      typingStatus.forEach((users, roomId) => {
        users.delete(userId);
        if (users.size === 0) {
          typingStatus.delete(roomId);
        }
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Helper function to get all socket IDs for a user
const getUserSockets = (userId) => {
  const userIdStr = userId.toString();
  if (!connectedUsers.has(userIdStr)) return [];
  return Array.from(connectedUsers.get(userIdStr));
};

// Helper function to check if user is online
const isUserOnline = (userId) => {
  const userIdStr = userId.toString();
  return connectedUsers.has(userIdStr) && connectedUsers.get(userIdStr).size > 0;
};

module.exports = { initializeSocket, getUserSockets, isUserOnline };

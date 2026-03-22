const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file'],
      required: true
    },
    text: {
      type: String,
      trim: true,
      maxlength: 10000
    },
    mediaUrl: String,
    metadata: {
      duration: Number,
      fileSize: Number,
      fileName: String
    }
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isEphemeral: {
    type: Boolean,
    default: false
  },
  ephemeralExpiresAt: {
    type: Date,
    index: {
      expireAfterSeconds: 0,
      partialFilterExpression: { isEphemeral: true }
    }
  },
  deliveryStatus: {
    delivered: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    read: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
messageSchema.index({ roomId: 1, createdAt: -1 });

// Method to add delivery status
messageSchema.methods.markAsDelivered = function(userId) {
  if (!this.deliveryStatus.delivered.includes(userId)) {
    this.deliveryStatus.delivered.push(userId);
  }
  return this.save();
};

// Method to mark as read
messageSchema.methods.markAsRead = function(userId) {
  if (!this.deliveryStatus.read.includes(userId)) {
    this.deliveryStatus.read.push(userId);
  }
  return this.save();
};

// Method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  const existingReaction = this.reactions.find(
    r => r.userId.toString() === userId.toString()
  );

  if (existingReaction) {
    existingReaction.emoji = emoji;
  } else {
    this.reactions.push({ userId, emoji });
  }

  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
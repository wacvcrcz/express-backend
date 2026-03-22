const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: null
    },
    muted: {
      type: Boolean,
      default: false
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  groupSettings: {
    name: {
      type: String,
      maxlength: 100
    },
    avatar: String,
    description: String,
    inviteLink: String,
    maxMembers: {
      type: Number,
      default: 100
    }
  },
  ephemeralSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    ttlSeconds: {
      type: Number,
      default: 300
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
roomSchema.index({ participants: 1 });
roomSchema.index({ type: 1, 'participants.userId': 1 });
roomSchema.index({ 'groupSettings.inviteLink': 1 }, { sparse: true });

// Method to check if user is in room
roomSchema.methods.hasParticipant = function(userId) {
  return this.participants.some(p => p.userId.toString() === userId.toString());
};

module.exports = mongoose.model('Room', roomSchema);
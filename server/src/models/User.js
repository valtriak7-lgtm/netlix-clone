// File purpose: Application logic for this Netflix Clone module.
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    profileId: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    subscription: {
      plan: {
        type: String,
        enum: ['mobile', 'basic', 'standard', 'premium'],
        default: 'basic',
      },
      status: {
        type: String,
        enum: ['active', 'paused', 'cancelled'],
        default: 'active',
      },
      services: {
        type: [String],
        default: [],
      },
      renewalDate: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

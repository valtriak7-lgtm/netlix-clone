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
    adminScope: {
      type: String,
      enum: ['content_manager', 'analytics_viewer', 'full_access'],
      default: 'content_manager',
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
    profileId: {
      type: String,
      default: '',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerification: {
      tokenHash: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
      requestedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
    },
    passwordReset: {
      tokenHash: { type: String, default: '' },
      expiresAt: { type: Date, default: null },
      requestedAt: { type: Date, default: null },
      usedAt: { type: Date, default: null },
    },
    refreshTokens: {
      type: [
        {
          tokenHash: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
          expiresAt: { type: Date, required: true },
          revokedAt: { type: Date, default: null },
          userAgent: { type: String, default: '' },
          ipAddress: { type: String, default: '' },
        },
      ],
      default: [],
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    terminatedAt: {
      type: Date,
      default: null,
    },
    watchHistory: {
      type: [
        {
          movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', default: null },
          title: { type: String, default: '' },
          watchedAt: { type: Date, default: Date.now },
          progressMinutes: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    watchProgress: {
      type: [
        {
          movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', default: null },
          title: { type: String, default: '' },
          progressPercent: { type: Number, default: 0 },
          lastPositionSeconds: { type: Number, default: 0 },
          durationSeconds: { type: Number, default: 0 },
          seasonNumber: { type: Number, default: null },
          episodeNumber: { type: Number, default: null },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    downloadHistory: {
      type: [
        {
          movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', default: null },
          title: { type: String, default: '' },
          downloadedAt: { type: Date, default: Date.now },
          quality: { type: String, default: '720p' },
        },
      ],
      default: [],
    },
    paymentHistory: {
      type: [
        {
          invoiceId: { type: String, default: '' },
          amount: { type: Number, default: 0 },
          currency: { type: String, default: 'INR' },
          status: { type: String, enum: ['paid', 'failed', 'refunded', 'pending'], default: 'pending' },
          paidAt: { type: Date, default: Date.now },
          plan: { type: String, default: 'basic' },
        },
      ],
      default: [],
    },
    sessionMetrics: {
      totalHoursWatched: { type: Number, default: 0 },
      lastActiveAt: { type: Date, default: null },
      monthlySessions: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

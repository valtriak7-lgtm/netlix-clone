const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const {
  hashToken,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  createOneTimeToken,
  ACCESS_TOKEN_TTL_SECONDS,
} = require('../utils/tokenService');

const MAX_REFRESH_TOKENS_PER_USER = Number(process.env.MAX_REFRESH_TOKENS_PER_USER || 5);

function sanitizeUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    avatar: userDoc.avatar,
    profileId: userDoc.profileId || '',
    role: userDoc.role || 'user',
    isEmailVerified: Boolean(userDoc.isEmailVerified),
    subscription: {
      plan: userDoc.subscription?.plan || 'basic',
      status: userDoc.subscription?.status || 'active',
      services: Array.isArray(userDoc.subscription?.services) ? userDoc.subscription.services : [],
      renewalDate: userDoc.subscription?.renewalDate || null,
    },
    createdAt: userDoc.createdAt,
  };
}

function assertDbConnected() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database is not connected. Check server MongoDB config.');
    error.status = 503;
    throw error;
  }
}

function pickActorUser(req, fallbackUserId = '') {
  const token = String(req.headers.authorization || '').startsWith('Bearer ')
    ? String(req.headers.authorization).slice(7).trim()
    : '';
  const tokenPayload = token ? verifyAccessToken(token) : null;
  return tokenPayload?.userId || String(fallbackUserId || '').trim();
}

function issueAccessToken(user) {
  return createAccessToken({
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
    isEmailVerified: Boolean(user.isEmailVerified),
  });
}

function registerRefreshToken(user, req) {
  const { token, expiresAt } = createRefreshToken();
  const tokenHash = hashToken(token);

  user.refreshTokens = Array.isArray(user.refreshTokens) ? user.refreshTokens : [];
  user.refreshTokens.push({
    tokenHash,
    expiresAt,
    createdAt: new Date(),
    revokedAt: null,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 255),
    ipAddress: String(req.ip || ''),
  });

  user.refreshTokens = user.refreshTokens
    .filter((entry) => !entry.revokedAt && new Date(entry.expiresAt).getTime() > Date.now())
    .slice(-MAX_REFRESH_TOKENS_PER_USER);

  return token;
}

function authPayload(user, accessToken, refreshToken, extras = {}) {
  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    ...extras,
  };
}

async function register(req, res, next) {
  try {
    assertDbConnected();
    const { name = '', email = '', password = '', role = 'user' } = req.body || {};

    if (!name.trim() || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'User already exists. Please sign in.' });
    }

    const displayName = name.trim();
    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
    const allowedRoles = new Set(['user', 'admin', 'superadmin']);
    const safeRole = allowedRoles.has(String(role).toLowerCase()) ? String(role).toLowerCase() : 'user';
    const profileId = `user-${Date.now().toString(36).slice(-6)}`;

    const user = await User.create({
      name: displayName,
      email: normalizedEmail,
      passwordHash,
      avatar,
      role: safeRole,
      profileId,
      isEmailVerified: false,
      subscription: {
        plan: 'basic',
        status: 'active',
        services: ['streaming-hd'],
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const verificationTokenRecord = createOneTimeToken(60);
    user.emailVerification = {
      tokenHash: hashToken(verificationTokenRecord.token),
      expiresAt: verificationTokenRecord.expiresAt,
      requestedAt: new Date(),
      verifiedAt: null,
    };

    const accessToken = issueAccessToken(user);
    const refreshToken = registerRefreshToken(user, req);
    await user.save();

    return res.status(201).json({
      message: 'Account created',
      data: authPayload(user, accessToken, refreshToken, {
        emailVerificationToken:
          process.env.NODE_ENV !== 'production' ? verificationTokenRecord.token : undefined,
      }),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    assertDbConnected();
    const { email = '', password = '' } = req.body || {};
    if (!email.trim() || !password.trim()) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    if (user.terminatedAt) {
      return res.status(403).json({ message: 'Account is terminated.' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account is suspended.' });
    }

    const isValid = await bcrypt.compare(password.trim(), user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const accessToken = issueAccessToken(user);
    const refreshToken = registerRefreshToken(user, req);
    await user.save();

    return res.status(200).json({
      message: 'Login successful',
      data: authPayload(user, accessToken, refreshToken),
    });
  } catch (error) {
    return next(error);
  }
}

async function refreshSession(req, res, next) {
  try {
    assertDbConnected();
    const { refreshToken = '' } = req.body || {};
    if (!refreshToken.trim()) {
      return res.status(400).json({ message: 'refreshToken is required.' });
    }

    const tokenHash = hashToken(refreshToken.trim());
    const user = await User.findOne({
      refreshTokens: {
        $elemMatch: {
          tokenHash,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        },
      },
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token.' });
    }

    user.refreshTokens = (user.refreshTokens || []).map((entry) => (
      entry.tokenHash === tokenHash ? { ...entry.toObject(), revokedAt: new Date() } : entry
    ));

    const accessToken = issueAccessToken(user);
    const nextRefreshToken = registerRefreshToken(user, req);
    await user.save();

    return res.status(200).json({
      message: 'Session refreshed',
      data: authPayload(user, accessToken, nextRefreshToken),
    });
  } catch (error) {
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    assertDbConnected();
    const { refreshToken = '' } = req.body || {};
    if (!refreshToken.trim()) {
      return res.status(400).json({ message: 'refreshToken is required.' });
    }

    const tokenHash = hashToken(refreshToken.trim());
    await User.updateOne(
      { 'refreshTokens.tokenHash': tokenHash },
      { $set: { 'refreshTokens.$.revokedAt': new Date() } }
    );

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    return next(error);
  }
}

async function requestEmailVerification(req, res, next) {
  try {
    assertDbConnected();
    const actorUserId = pickActorUser(req, req.body?.userId);
    if (!actorUserId) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const user = await User.findById(actorUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (user.isEmailVerified) {
      return res.status(200).json({ message: 'Email is already verified.' });
    }

    const tokenRecord = createOneTimeToken(60);
    user.emailVerification = {
      tokenHash: hashToken(tokenRecord.token),
      expiresAt: tokenRecord.expiresAt,
      requestedAt: new Date(),
      verifiedAt: null,
    };
    await user.save();

    return res.status(200).json({
      message: 'Verification email queued.',
      data: {
        verificationToken:
          process.env.NODE_ENV !== 'production' ? tokenRecord.token : undefined,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmEmailVerification(req, res, next) {
  try {
    assertDbConnected();
    const { token = '' } = req.body || {};
    if (!token.trim()) {
      return res.status(400).json({ message: 'Verification token is required.' });
    }

    const tokenHash = hashToken(token.trim());
    const user = await User.findOne({
      'emailVerification.tokenHash': tokenHash,
      'emailVerification.expiresAt': { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Verification token is invalid or expired.' });
    }

    user.isEmailVerified = true;
    user.emailVerification.verifiedAt = new Date();
    user.emailVerification.tokenHash = '';
    await user.save();

    return res.status(200).json({ message: 'Email verified successfully.', data: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    assertDbConnected();
    const { email = '' } = req.body || {};
    if (!email.trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    }

    const resetToken = createOneTimeToken(30);
    user.passwordReset = {
      tokenHash: hashToken(resetToken.token),
      expiresAt: resetToken.expiresAt,
      requestedAt: new Date(),
      usedAt: null,
    };
    await user.save();

    return res.status(200).json({
      message: 'Password reset link generated.',
      data: {
        resetToken: process.env.NODE_ENV !== 'production' ? resetToken.token : undefined,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    assertDbConnected();
    const { token = '', newPassword = '' } = req.body || {};
    if (!token.trim() || !newPassword.trim()) {
      return res.status(400).json({ message: 'Reset token and new password are required.' });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const tokenHash = hashToken(token.trim());
    const user = await User.findOne({
      'passwordReset.tokenHash': tokenHash,
      'passwordReset.expiresAt': { $gt: new Date() },
      'passwordReset.usedAt': null,
    });
    if (!user) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    user.passwordReset.usedAt = new Date();
    user.passwordReset.tokenHash = '';
    user.refreshTokens = [];
    await user.save();

    return res.status(200).json({ message: 'Password reset successful. Please sign in again.' });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    assertDbConnected();
    const actorUserId = pickActorUser(req, req.body?.userId);
    const { name = '', email = '', avatar = '' } = req.body || {};
    if (!actorUserId) {
      return res.status(400).json({ message: 'User id is required.' });
    }

    const user = await User.findById(actorUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (name.trim()) {
      user.name = name.trim();
      if (!user.profileId) {
        user.profileId = `user-${Date.now().toString(36).slice(-6)}`;
      }
    }

    if (email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: 'Email is already in use.' });
      }
      if (normalizedEmail !== user.email) {
        user.isEmailVerified = false;
      }
      user.email = normalizedEmail;
    }

    if (avatar.trim()) {
      user.avatar = avatar.trim();
    } else if (name.trim() && !user.avatar) {
      user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}`;
    }

    await user.save();
    return res.status(200).json({
      message: 'Profile updated',
      data: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    assertDbConnected();
    const actorUserId = pickActorUser(req, req.body?.userId);
    const { currentPassword = '', newPassword = '' } = req.body || {};
    if (!actorUserId || !currentPassword.trim() || !newPassword.trim()) {
      return res.status(400).json({ message: 'User, current password, and new password are required.' });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(actorUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword.trim(), user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    user.refreshTokens = [];
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  refreshSession,
  logout,
  requestEmailVerification,
  confirmEmailVerification,
  forgotPassword,
  resetPassword,
  updateProfile,
  updatePassword,
};


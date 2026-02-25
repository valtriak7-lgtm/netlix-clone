const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

function sanitizeUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    name: userDoc.name,
    email: userDoc.email,
    avatar: userDoc.avatar,
    role: userDoc.role || 'user',
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

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const displayName = name.trim();
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;

    const allowedRoles = new Set(['user', 'admin', 'superadmin']);
    const safeRole = allowedRoles.has(String(role).toLowerCase()) ? String(role).toLowerCase() : 'user';

    const user = await User.create({
      name: displayName,
      email: normalizedEmail,
      passwordHash,
      avatar,
      role: safeRole,
      subscription: {
        plan: 'basic',
        status: 'active',
        services: ['streaming-hd'],
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return res.status(201).json({
      message: 'Account created',
      data: sanitizeUser(user),
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

    const isValid = await bcrypt.compare(password.trim(), user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.status(200).json({
      message: 'Login successful',
      data: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    assertDbConnected();
    const { userId = '', name = '', email = '', avatar = '' } = req.body || {};

    if (!userId.trim()) {
      return res.status(400).json({ message: 'User id is required.' });
    }

    const user = await User.findById(userId.trim());
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (name.trim()) {
      user.name = name.trim();
    }

    if (email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: 'Email is already in use.' });
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
    const { userId = '', currentPassword = '', newPassword = '' } = req.body || {};

    if (!userId.trim() || !currentPassword.trim() || !newPassword.trim()) {
      return res.status(400).json({ message: 'User id, current password, and new password are required.' });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(userId.trim());
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isValid = await bcrypt.compare(currentPassword.trim(), user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  updateProfile,
  updatePassword,
};

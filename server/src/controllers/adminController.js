// File purpose: Application logic for this Netflix Clone module.
const mongoose = require('mongoose');
const User = require('../models/User');

function assertDbConnected() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database is not connected. Admin actions require MongoDB.');
    error.status = 503;
    throw error;
  }
}

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
    updatedAt: userDoc.updatedAt,
  };
}

function getActorId(req) {
  const actorId = req.query.actorId || req.body?.actorId;
  if (!actorId || typeof actorId !== 'string' || !actorId.trim()) {
    const error = new Error('actorId is required for admin actions.');
    error.status = 400;
    throw error;
  }
  return actorId.trim();
}

async function getActor(req) {
  const actorId = getActorId(req);
  const actor = await User.findById(actorId);
  if (!actor) {
    const error = new Error('Admin actor not found.');
    error.status = 404;
    throw error;
  }
  return actor;
}

function requireRole(actor, roles) {
  if (!roles.includes(actor.role)) {
    const error = new Error('Not authorized for this action.');
    error.status = 403;
    throw error;
  }
}

async function listUsers(req, res, next) {
  try {
    assertDbConnected();
    const actor = await getActor(req);
    requireRole(actor, ['admin', 'superadmin']);

    const search = String(req.query.search || '').trim();
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(filter).sort({ createdAt: -1 }).limit(300);
    return res.status(200).json({
      count: users.length,
      data: users.map(sanitizeUser),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUserSubscription(req, res, next) {
  try {
    assertDbConnected();
    const actor = await getActor(req);
    requireRole(actor, ['admin', 'superadmin']);

    const { id } = req.params;
    const { plan = '', status = '', services = null, renewalDate = null } = req.body || {};
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const allowedPlans = new Set(['mobile', 'basic', 'standard', 'premium']);
    const allowedStatuses = new Set(['active', 'paused', 'cancelled']);

    if (plan && allowedPlans.has(plan)) {
      user.subscription.plan = plan;
    }
    if (status && allowedStatuses.has(status)) {
      user.subscription.status = status;
    }
    if (Array.isArray(services)) {
      user.subscription.services = services.filter((item) => typeof item === 'string');
    }
    if (renewalDate) {
      user.subscription.renewalDate = new Date(renewalDate);
    }

    await user.save();
    return res.status(200).json({
      message: 'User subscription updated.',
      data: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  try {
    assertDbConnected();
    const actor = await getActor(req);
    requireRole(actor, ['superadmin']);

    const { id } = req.params;
    const { role = '' } = req.body || {};
    const allowedRoles = new Set(['user', 'admin', 'superadmin']);
    if (!allowedRoles.has(role)) {
      return res.status(400).json({ message: 'Invalid role value.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      message: 'User role updated.',
      data: sanitizeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    assertDbConnected();
    const actor = await getActor(req);
    requireRole(actor, ['superadmin']);

    const { id } = req.params;
    if (actor._id.toString() === id) {
      return res.status(400).json({ message: 'Super admin cannot delete own account.' });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ message: 'User deleted.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  updateUserSubscription,
  updateUserRole,
  deleteUser,
};

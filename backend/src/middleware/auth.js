const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokenService');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ message: 'Missing access token.' });
    }

    const payload = verifyAccessToken(token);
    if (!payload?.userId) {
      return res.status(401).json({ message: 'Invalid or expired access token.' });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.terminatedAt) {
      return res.status(401).json({ message: 'User account is unavailable.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account is suspended.' });
    }

    req.auth = {
      userId: user._id.toString(),
      role: user.role,
      emailVerified: Boolean(user.isEmailVerified),
    };
    req.userDoc = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireAuth,
};


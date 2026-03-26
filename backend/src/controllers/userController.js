const mongoose = require('mongoose');

function toObjectIdOrNull(rawId) {
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function normalizeProgressEntry(entry) {
  return {
    movieId: entry.movieId ? entry.movieId.toString() : null,
    title: entry.title || '',
    progressPercent: Number(entry.progressPercent || 0),
    lastPositionSeconds: Number(entry.lastPositionSeconds || 0),
    durationSeconds: Number(entry.durationSeconds || 0),
    seasonNumber: Number.isFinite(entry.seasonNumber) ? Number(entry.seasonNumber) : null,
    episodeNumber: Number.isFinite(entry.episodeNumber) ? Number(entry.episodeNumber) : null,
    updatedAt: entry.updatedAt || null,
  };
}

async function getWatchProgress(req, res, next) {
  try {
    const user = req.userDoc;
    const rows = (user.watchProgress || [])
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .map(normalizeProgressEntry);

    return res.status(200).json({ count: rows.length, data: rows });
  } catch (error) {
    return next(error);
  }
}

async function upsertWatchProgress(req, res, next) {
  try {
    const user = req.userDoc;
    const movieIdParam = String(req.params.movieId || '').trim();
    const {
      title = '',
      progressPercent = 0,
      lastPositionSeconds = 0,
      durationSeconds = 0,
      seasonNumber = null,
      episodeNumber = null,
    } = req.body || {};

    const safeProgress = Math.max(0, Math.min(100, Number(progressPercent) || 0));
    if (!movieIdParam) {
      return res.status(400).json({ message: 'movieId is required.' });
    }

    const movieObjectId = toObjectIdOrNull(movieIdParam);
    const index = (user.watchProgress || []).findIndex((entry) => (
      entry.movieId ? entry.movieId.toString() === movieIdParam : false
    ));

    const payload = {
      movieId: movieObjectId,
      title: String(title || '').trim(),
      progressPercent: safeProgress,
      lastPositionSeconds: Math.max(0, Number(lastPositionSeconds) || 0),
      durationSeconds: Math.max(0, Number(durationSeconds) || 0),
      seasonNumber: Number.isFinite(Number(seasonNumber)) ? Number(seasonNumber) : null,
      episodeNumber: Number.isFinite(Number(episodeNumber)) ? Number(episodeNumber) : null,
      updatedAt: new Date(),
    };

    user.watchProgress = Array.isArray(user.watchProgress) ? user.watchProgress : [];
    if (index >= 0) {
      user.watchProgress[index] = payload;
    } else {
      user.watchProgress.push(payload);
    }

    if (safeProgress >= 1) {
      user.watchHistory = Array.isArray(user.watchHistory) ? user.watchHistory : [];
      user.watchHistory.unshift({
        movieId: movieObjectId,
        title: payload.title,
        watchedAt: new Date(),
        progressMinutes: Math.round(payload.lastPositionSeconds / 60),
      });
      user.watchHistory = user.watchHistory.slice(0, 80);
    }

    await user.save();
    return res.status(200).json({ message: 'Watch progress saved.', data: normalizeProgressEntry(payload) });
  } catch (error) {
    return next(error);
  }
}

async function getContinueWatching(req, res, next) {
  try {
    const user = req.userDoc;
    const rows = (user.watchProgress || [])
      .filter((entry) => Number(entry.progressPercent || 0) > 0 && Number(entry.progressPercent || 0) < 99)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .map(normalizeProgressEntry);

    return res.status(200).json({ count: rows.length, data: rows });
  } catch (error) {
    return next(error);
  }
}

async function getWatchHistory(req, res, next) {
  try {
    const user = req.userDoc;
    const rows = (user.watchHistory || [])
      .sort((a, b) => new Date(b.watchedAt || 0).getTime() - new Date(a.watchedAt || 0).getTime())
      .slice(0, 100)
      .map((entry) => ({
        movieId: entry.movieId ? entry.movieId.toString() : null,
        title: entry.title || '',
        watchedAt: entry.watchedAt || null,
        progressMinutes: Number(entry.progressMinutes || 0),
      }));

    return res.status(200).json({ count: rows.length, data: rows });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getWatchProgress,
  upsertWatchProgress,
  getContinueWatching,
  getWatchHistory,
};


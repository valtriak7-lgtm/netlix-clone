const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const User = require('../models/User');

const billingStore = {
  plans: [
    { id: 'basic', name: 'Basic', price: 199, currency: 'INR', features: ['480p', '1 screen'] },
    { id: 'standard', name: 'Standard', price: 499, currency: 'INR', features: ['1080p', '2 screens'] },
    { id: 'premium', name: 'Premium', price: 649, currency: 'INR', features: ['4K', '4 screens'] },
  ],
  promotions: [],
};

function assertDbConnected() {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error('Database is not connected. Admin actions require MongoDB.');
    error.status = 503;
    throw error;
  }
}

function parseListValue(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  return String(input).split(',').map((x) => x.trim()).filter(Boolean);
}

function parseCsvLine(line) {
  let token = '';
  let inQuotes = false;
  const out = [];
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        token += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(token.trim());
      token = '';
    } else token += c;
  }
  out.push(token.trim());
  return out;
}

function sanitizeUser(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role || 'user',
    adminScope: u.adminScope || 'content_manager',
    isSuspended: Boolean(u.isSuspended),
    terminatedAt: u.terminatedAt || null,
    subscription: {
      plan: u.subscription?.plan || 'basic',
      status: u.subscription?.status || 'active',
      services: Array.isArray(u.subscription?.services) ? u.subscription.services : [],
      renewalDate: u.subscription?.renewalDate || null,
    },
    watchHistory: Array.isArray(u.watchHistory) ? u.watchHistory : [],
    downloadHistory: Array.isArray(u.downloadHistory) ? u.downloadHistory : [],
    paymentHistory: Array.isArray(u.paymentHistory) ? u.paymentHistory : [],
    sessionMetrics: u.sessionMetrics || {},
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function sanitizeMovie(m) {
  const movie = m.toObject ? m.toObject() : m;
  return {
    id: movie._id.toString(),
    title: movie.title,
    synopsis: movie.synopsis || movie.description || '',
    description: movie.description || '',
    cast: Array.isArray(movie.cast) ? movie.cast : [],
    crew: Array.isArray(movie.crew) ? movie.crew : [],
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    tags: Array.isArray(movie.tags) ? movie.tags : [],
    category: movie.category || '',
    categoryOverrides: Array.isArray(movie.categoryOverrides) ? movie.categoryOverrides : [],
    type: movie.type || 'movie',
    maturityRating: movie.maturityRating || movie.rating || '',
    releaseDate: movie.releaseDate || null,
    year: movie.year,
    duration: movie.duration || '',
    durationMinutes: movie.durationMinutes || null,
    languages: Array.isArray(movie.languages) ? movie.languages : [],
    imageUrl: movie.imageUrl,
    backdropUrl: movie.backdropUrl,
    thumbnailUrl: movie.thumbnailUrl || '',
    posterUrl: movie.posterUrl || movie.imageUrl || '',
    trailerUrl: movie.trailerUrl || '',
    trailerFileUrl: movie.trailerFileUrl || '',
    videoAssets: movie.videoAssets || {},
    seasons: Array.isArray(movie.seasons) ? movie.seasons : [],
    collections: Array.isArray(movie.collections) ? movie.collections : [],
    featured: Boolean(movie.featured),
    featuredRank: movie.featuredRank ?? null,
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt,
  };
}

function buildContentPayload(payload = {}) {
  const releaseDate = payload.releaseDate ? new Date(payload.releaseDate) : null;
  const year = Number(payload.year);
  return {
    title: String(payload.title || 'Untitled').trim(),
    synopsis: String(payload.synopsis || payload.description || '').trim(),
    description: String(payload.description || payload.synopsis || 'No description provided.').trim(),
    cast: parseListValue(payload.cast),
    crew: parseListValue(payload.crew),
    genres: parseListValue(payload.genres),
    tags: parseListValue(payload.tags),
    category: String(payload.category || 'Featured').trim(),
    categoryOverrides: parseListValue(payload.categoryOverrides),
    type: String(payload.type || 'movie').toLowerCase() === 'series' ? 'series' : 'movie',
    maturityRating: String(payload.maturityRating || payload.rating || 'U/A 13+').trim(),
    rating: String(payload.rating || payload.maturityRating || 'U/A 13+').trim(),
    releaseDate: releaseDate instanceof Date && !Number.isNaN(releaseDate.getTime()) ? releaseDate : null,
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    duration: String(payload.duration || '120 min').trim(),
    durationMinutes: Number(payload.durationMinutes) || null,
    languages: parseListValue(payload.languages),
    imageUrl: String(payload.imageUrl || payload.thumbnailUrl || payload.posterUrl || '').trim(),
    thumbnailUrl: String(payload.thumbnailUrl || '').trim(),
    posterUrl: String(payload.posterUrl || '').trim(),
    backdropUrl: String(payload.backdropUrl || payload.imageUrl || '').trim(),
    trailerUrl: String(payload.trailerUrl || '').trim(),
    trailerFileUrl: String(payload.trailerFileUrl || '').trim(),
    collections: parseListValue(payload.collections),
    featured: Boolean(payload.featured),
    featuredRank: Number.isFinite(Number(payload.featuredRank)) ? Number(payload.featuredRank) : null,
    videoAssets: {
      sourceUrl: String(payload.videoAssets?.sourceUrl || payload.sourceUrl || '').trim(),
      formats: parseListValue(payload.videoAssets?.formats || payload.formats),
      qualityVariants: parseListValue(payload.videoAssets?.qualityVariants || payload.qualityVariants),
      subtitles: parseListValue(payload.videoAssets?.subtitles || payload.subtitles),
      audioTracks: parseListValue(payload.videoAssets?.audioTracks || payload.audioTracks),
    },
  };
}

async function getActor(req) {
  const actorId = String(req.query.actorId || req.body?.actorId || '').trim();
  if (!actorId) {
    const e = new Error('actorId is required for admin actions.');
    e.status = 400;
    throw e;
  }
  const actor = await User.findById(actorId);
  if (!actor) {
    const e = new Error('Admin actor not found.');
    e.status = 404;
    throw e;
  }
  if (!['admin', 'superadmin'].includes(actor.role)) {
    const e = new Error('Not authorized for admin actions.');
    e.status = 403;
    throw e;
  }
  return actor;
}

function hasCap(actor, cap) {
  if (actor.role === 'superadmin') return true;
  const scope = actor.adminScope || 'content_manager';
  if (scope === 'full_access') return true;
  if (scope === 'analytics_viewer') return ['dashboard', 'analytics'].includes(cap);
  return ['dashboard', 'analytics', 'content', 'video', 'users', 'billing'].includes(cap);
}

function ensureCap(actor, cap) {
  if (!hasCap(actor, cap)) {
    const e = new Error(`Not authorized for ${cap}.`);
    e.status = 403;
    throw e;
  }
}

async function withActor(req, res, next, cap, fn) {
  try {
    assertDbConnected();
    const actor = await getActor(req);
    ensureCap(actor, cap);
    return await fn(actor);
  } catch (error) {
    return next(error);
  }
}

async function getDashboardMetrics(req, res, next) {
  return withActor(req, res, next, 'dashboard', async () => {
    const [users, movies] = await Promise.all([User.find({ terminatedAt: null }).lean(), Movie.find({}).lean()]);
    const now = Date.now();
    const dau = users.filter((u) => new Date(u.sessionMetrics?.lastActiveAt || u.updatedAt || 0).getTime() > now - 86400000).length;
    const hours = users.reduce((a, u) => a + Number(u.sessionMetrics?.totalHoursWatched || 0), 0);
    const revenue = users.reduce((sum, u) => sum + (u.paymentHistory || []).filter((p) => p.status === 'paid').reduce((x, p) => x + Number(p.amount || 0), 0), 0);
    const top = movies.slice(0, 8).map((m) => ({ id: m._id.toString(), title: m.title, views: (m.featured ? 20000 : 7000) + Math.floor(Math.random() * 40000) })).sort((a, b) => b.views - a.views).slice(0, 5);
    return res.status(200).json({ data: { totalSubscribers: users.length, dailyActiveUsers: dau, contentConsumptionHours: Number(hours.toFixed(1)), revenueMetrics: { totalRevenue: revenue, currency: 'INR' }, topPerformingContent: top, userRetentionRate: users.length ? Number(((users.filter((u) => !u.terminatedAt).length / users.length) * 100).toFixed(2)) : 0 } });
  });
}

async function getRealtimeSystemMonitoring(req, res, next) {
  return withActor(req, res, next, 'dashboard', async () => res.status(200).json({ data: { timestamp: new Date().toISOString(), health: 'healthy', cpuLoad: Number((20 + Math.random() * 60).toFixed(2)), memoryUsage: Number((30 + Math.random() * 50).toFixed(2)), playbackErrorRate: Number((Math.random() * 2).toFixed(2)), activeStreams: Math.floor(500 + Math.random() * 6000), apiLatencyMs: Math.floor(35 + Math.random() * 90), database: mongoose.connection.readyState === 1 ? 'healthy' : 'unavailable' } }));
}

async function listContent(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || '').trim();
    const filter = {};
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
    if (type) filter.type = type;
    const rows = await Movie.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.status(200).json({ count: rows.length, data: rows.map(sanitizeMovie) });
  });
}

async function createContent(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.create(buildContentPayload(req.body || {}));
    return res.status(201).json({ message: 'Content created.', data: sanitizeMovie(doc) });
  });
}

async function updateContent(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findByIdAndUpdate(req.params.id, buildContentPayload(req.body || {}), { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    return res.status(200).json({ message: 'Content updated.', data: sanitizeMovie(doc) });
  });
}

async function deleteContent(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    return res.status(200).json({ message: 'Content deleted.' });
  });
}

async function bulkUploadContent(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const csvText = String(req.body?.csvText || '').trim();
    const parsed = [...rows];
    if (!parsed.length && csvText) {
      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const headers = parseCsvLine(lines[0]);
        lines.slice(1).forEach((line) => {
          const vals = parseCsvLine(line);
          const rec = {};
          headers.forEach((h, i) => { rec[h] = vals[i] || ''; });
          parsed.push(rec);
        });
      }
    }
    if (!parsed.length) return res.status(400).json({ message: 'Provide rows[] or csvText.' });
    const inserted = await Movie.insertMany(parsed.map(buildContentPayload), { ordered: false });
    return res.status(201).json({ message: 'Bulk upload done.', count: inserted.length, data: inserted.map(sanitizeMovie) });
  });
}

async function addSeason(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    if (doc.type !== 'series') return res.status(400).json({ message: 'Seasons only apply to series.' });
    const seasonNumber = Number(req.body?.seasonNumber);
    if (!Number.isInteger(seasonNumber) || seasonNumber <= 0) return res.status(400).json({ message: 'seasonNumber required.' });
    if (doc.seasons.some((s) => s.seasonNumber === seasonNumber)) return res.status(409).json({ message: 'Season already exists.' });
    doc.seasons.push({ seasonNumber, title: String(req.body?.title || `Season ${seasonNumber}`), episodes: [] });
    doc.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
    await doc.save();
    return res.status(201).json({ message: 'Season added.', data: sanitizeMovie(doc) });
  });
}

async function addEpisode(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    const season = doc.seasons.find((s) => s.seasonNumber === Number(req.params.seasonNumber));
    if (!season) return res.status(404).json({ message: 'Season not found.' });
    const episodeNumber = Number(req.body?.episodeNumber);
    if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) return res.status(400).json({ message: 'episodeNumber required.' });
    if (season.episodes.some((e) => e.episodeNumber === episodeNumber)) return res.status(409).json({ message: 'Episode already exists.' });
    season.episodes.push({ episodeNumber, title: String(req.body?.title || `Episode ${episodeNumber}`), description: String(req.body?.description || ''), airDate: req.body?.airDate ? new Date(req.body.airDate) : null, durationMinutes: Number(req.body?.durationMinutes) || null, videoUrl: String(req.body?.videoUrl || '') });
    season.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    await doc.save();
    return res.status(201).json({ message: 'Episode added.', data: sanitizeMovie(doc) });
  });
}

async function updateEpisode(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    const season = doc.seasons.find((s) => s.seasonNumber === Number(req.params.seasonNumber));
    if (!season) return res.status(404).json({ message: 'Season not found.' });
    const episode = season.episodes.find((e) => e.episodeNumber === Number(req.params.episodeNumber));
    if (!episode) return res.status(404).json({ message: 'Episode not found.' });
    const body = req.body || {};
    if (typeof body.title === 'string') episode.title = body.title.trim();
    if (typeof body.description === 'string') episode.description = body.description.trim();
    if (body.airDate) episode.airDate = new Date(body.airDate);
    if (body.durationMinutes !== undefined) episode.durationMinutes = Number(body.durationMinutes) || episode.durationMinutes;
    if (typeof body.videoUrl === 'string') episode.videoUrl = body.videoUrl.trim();
    await doc.save();
    return res.status(200).json({ message: 'Episode updated.', data: sanitizeMovie(doc) });
  });
}

async function updateContentOrganization(req, res, next) {
  return withActor(req, res, next, 'content', async () => {
    const doc = await Movie.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    if (req.body?.collections !== undefined) doc.collections = parseListValue(req.body.collections);
    if (req.body?.categoryOverrides !== undefined) doc.categoryOverrides = parseListValue(req.body.categoryOverrides);
    if (req.body?.featured !== undefined) doc.featured = Boolean(req.body.featured);
    if (req.body?.featuredRank !== undefined) doc.featuredRank = Number(req.body.featuredRank) || null;
    await doc.save();
    return res.status(200).json({ message: 'Organization updated.', data: sanitizeMovie(doc) });
  });
}

async function updateVideoAssets(req, res, next) {
  return withActor(req, res, next, 'video', async () => {
    const doc = await Movie.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Content not found.' });
    doc.videoAssets = {
      sourceUrl: String(req.body?.sourceUrl || doc.videoAssets?.sourceUrl || ''),
      formats: parseListValue(req.body?.formats).length ? parseListValue(req.body?.formats) : doc.videoAssets?.formats || [],
      qualityVariants: parseListValue(req.body?.qualityVariants).length ? parseListValue(req.body?.qualityVariants) : doc.videoAssets?.qualityVariants || [],
      subtitles: parseListValue(req.body?.subtitles).length ? parseListValue(req.body?.subtitles) : doc.videoAssets?.subtitles || [],
      audioTracks: parseListValue(req.body?.audioTracks).length ? parseListValue(req.body?.audioTracks) : doc.videoAssets?.audioTracks || [],
    };
    if (typeof req.body?.trailerFileUrl === 'string') doc.trailerFileUrl = req.body.trailerFileUrl.trim();
    await doc.save();
    return res.status(200).json({ message: 'Video assets updated.', data: sanitizeMovie(doc) });
  });
}

async function listUsers(req, res, next) {
  return withActor(req, res, next, 'users', async () => {
    const search = String(req.query.search || '').trim();
    const plan = String(req.query.plan || '').trim();
    const filter = {};
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (plan) filter['subscription.plan'] = plan;
    const rows = await User.find(filter).sort({ createdAt: -1 }).limit(400);
    return res.status(200).json({ count: rows.length, data: rows.map(sanitizeUser) });
  });
}

async function getUserBehavior(req, res, next) {
  return withActor(req, res, next, 'analytics', async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ data: { user: sanitizeUser(user), watchHistory: user.watchHistory || [], downloadHistory: user.downloadHistory || [], paymentHistory: user.paymentHistory || [] } });
  });
}

async function updateUserSubscription(req, res, next) {
  return withActor(req, res, next, 'users', async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const { plan = '', status = '', services = null, renewalDate = null } = req.body || {};
    if (['mobile', 'basic', 'standard', 'premium'].includes(plan)) user.subscription.plan = plan;
    if (['active', 'paused', 'cancelled'].includes(status)) user.subscription.status = status;
    if (Array.isArray(services)) user.subscription.services = services.filter((x) => typeof x === 'string');
    if (renewalDate) user.subscription.renewalDate = new Date(renewalDate);
    await user.save();
    return res.status(200).json({ message: 'User subscription updated.', data: sanitizeUser(user) });
  });
}

async function updateUserRole(req, res, next) {
  return withActor(req, res, next, 'users', async (actor) => {
    if (actor.role !== 'superadmin') return res.status(403).json({ message: 'Only super admin can update roles.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const role = String(req.body?.role || '').trim();
    const adminScope = String(req.body?.adminScope || '').trim();
    if (!['user', 'admin', 'superadmin'].includes(role)) return res.status(400).json({ message: 'Invalid role value.' });
    user.role = role;
    user.adminScope = role === 'superadmin' ? 'full_access' : ['content_manager', 'analytics_viewer', 'full_access'].includes(adminScope) ? adminScope : 'content_manager';
    await user.save();
    return res.status(200).json({ message: 'User role updated.', data: sanitizeUser(user) });
  });
}

async function setUserSuspension(req, res, next) {
  return withActor(req, res, next, 'users', async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    user.isSuspended = Boolean(req.body?.isSuspended);
    await user.save();
    return res.status(200).json({ message: user.isSuspended ? 'User suspended.' : 'User reactivated.', data: sanitizeUser(user) });
  });
}

async function terminateUser(req, res, next) {
  return withActor(req, res, next, 'users', async (actor) => {
    if (actor.role !== 'superadmin') return res.status(403).json({ message: 'Only super admin can terminate accounts.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user._id.toString() === actor._id.toString()) return res.status(400).json({ message: 'Super admin cannot terminate own account.' });
    user.terminatedAt = new Date();
    user.subscription.status = 'cancelled';
    await user.save();
    return res.status(200).json({ message: 'User account terminated.', data: sanitizeUser(user) });
  });
}

async function resetUserPassword(req, res, next) {
  return withActor(req, res, next, 'users', async () => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const temporaryPassword = `Reset@${Math.random().toString(36).slice(-6)}1`;
    user.passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await user.save();
    return res.status(200).json({ message: 'Password reset successful.', data: { userId: user._id.toString(), temporaryPassword } });
  });
}

async function deleteUser(req, res, next) {
  return withActor(req, res, next, 'users', async (actor) => {
    if (actor.role !== 'superadmin') return res.status(403).json({ message: 'Only super admin can delete users.' });
    if (actor._id.toString() === req.params.id) return res.status(400).json({ message: 'Super admin cannot delete own account.' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'User deleted.' });
  });
}

async function getSubscriptionPlans(req, res, next) {
  return withActor(req, res, next, 'billing', async () => res.status(200).json({ count: billingStore.plans.length, data: billingStore.plans }));
}

async function upsertSubscriptionPlan(req, res, next) {
  return withActor(req, res, next, 'billing', async () => {
    const id = String(req.body?.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ message: 'Plan id is required.' });
    const payload = { id, name: String(req.body?.name || id).trim(), price: Number(req.body?.price || 0), currency: String(req.body?.currency || 'INR').trim(), features: parseListValue(req.body?.features) };
    const idx = billingStore.plans.findIndex((p) => p.id === id);
    if (idx >= 0) billingStore.plans[idx] = payload; else billingStore.plans.push(payload);
    return res.status(200).json({ message: 'Plan saved.', data: payload });
  });
}

async function getPromotions(req, res, next) {
  return withActor(req, res, next, 'billing', async () => res.status(200).json({ count: billingStore.promotions.length, data: billingStore.promotions }));
}

async function upsertPromotion(req, res, next) {
  return withActor(req, res, next, 'billing', async () => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ message: 'Promotion code is required.' });
    const payload = { code, discountPercent: Math.max(0, Math.min(100, Number(req.body?.discountPercent || 0))), freeTrialDays: Math.max(0, Number(req.body?.freeTrialDays || 0)), startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : null, endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null, partner: String(req.body?.partner || '').trim(), season: String(req.body?.season || '').trim() };
    const idx = billingStore.promotions.findIndex((p) => p.code === code);
    if (idx >= 0) billingStore.promotions[idx] = payload; else billingStore.promotions.push(payload);
    return res.status(200).json({ message: 'Promotion saved.', data: payload });
  });
}

async function generateInvoice(req, res, next) {
  return withActor(req, res, next, 'billing', async () => {
    const user = await User.findById(String(req.body?.userId || '').trim());
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const invoice = { invoiceId: `INV-${Date.now()}`, amount: Number(req.body?.amount || 0), currency: String(req.body?.currency || 'INR').trim(), status: String(req.body?.status || 'paid').trim(), paidAt: new Date(), plan: String(req.body?.plan || user.subscription?.plan || 'basic').trim() };
    user.paymentHistory.push(invoice);
    await user.save();
    return res.status(201).json({ message: 'Invoice generated.', data: invoice });
  });
}

async function listFailedPayments(req, res, next) {
  return withActor(req, res, next, 'billing', async () => {
    const users = await User.find({ 'paymentHistory.status': 'failed' }).lean();
    const failed = [];
    users.forEach((u) => (u.paymentHistory || []).forEach((p) => { if (p.status === 'failed') failed.push({ userId: u._id.toString(), userName: u.name, email: u.email, ...p }); }));
    return res.status(200).json({ count: failed.length, data: failed });
  });
}

async function getContentPerformance(req, res, next) {
  return withActor(req, res, next, 'analytics', async () => {
    const titles = await Movie.find({}).limit(200).lean();
    const data = titles.map((t) => ({ id: t._id.toString(), title: t.title, type: t.type, views: (t.featured ? 20000 : 6000) + Math.floor(Math.random() * 80000), trend: `${Math.round((Math.random() * 20 - 5) * 10) / 10}%` })).sort((a, b) => b.views - a.views);
    return res.status(200).json({ count: data.length, data });
  });
}

async function getUserEngagement(req, res, next) {
  return withActor(req, res, next, 'analytics', async () => {
    const users = await User.find({ terminatedAt: null }).lean();
    const dailyActiveUsers = users.filter((u) => new Date(u.sessionMetrics?.lastActiveAt || u.updatedAt || 0).getTime() > Date.now() - 86400000).length;
    const totalHours = users.reduce((sum, u) => sum + Number(u.sessionMetrics?.totalHoursWatched || 0), 0);
    const avgSessionMinutes = users.length ? Math.round((totalHours * 60) / users.length) : 0;
    const monthlySessionTrend = Array.from({ length: 7 }).map((_, i) => ({ day: i + 1, sessions: Math.floor(Math.random() * 2000) + 500 }));
    return res.status(200).json({ data: { dailyActiveUsers, avgSessionMinutes, monthlySessionTrend } });
  });
}

module.exports = {
  getDashboardMetrics,
  getRealtimeSystemMonitoring,
  listContent,
  createContent,
  updateContent,
  deleteContent,
  bulkUploadContent,
  addSeason,
  addEpisode,
  updateEpisode,
  updateContentOrganization,
  updateVideoAssets,
  listUsers,
  getUserBehavior,
  updateUserSubscription,
  updateUserRole,
  setUserSuspension,
  terminateUser,
  resetUserPassword,
  deleteUser,
  getSubscriptionPlans,
  upsertSubscriptionPlan,
  getPromotions,
  upsertPromotion,
  generateInvoice,
  listFailedPayments,
  getContentPerformance,
  getUserEngagement,
};

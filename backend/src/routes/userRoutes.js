const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getWatchProgress,
  upsertWatchProgress,
  getContinueWatching,
  getWatchHistory,
} = require('../controllers/userController');

const router = express.Router();

router.use(requireAuth);

router.get('/me/watch-progress', getWatchProgress);
router.put('/me/watch-progress/:movieId', upsertWatchProgress);
router.get('/me/continue-watching', getContinueWatching);
router.get('/me/watch-history', getWatchHistory);

module.exports = router;


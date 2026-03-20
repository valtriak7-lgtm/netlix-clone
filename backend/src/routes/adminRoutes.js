const express = require('express');
const {
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
} = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard/metrics', getDashboardMetrics);
router.get('/dashboard/realtime', getRealtimeSystemMonitoring);

router.get('/content', listContent);
router.post('/content', createContent);
router.post('/content/bulk-upload', bulkUploadContent);
router.put('/content/:id', updateContent);
router.delete('/content/:id', deleteContent);
router.post('/content/:id/seasons', addSeason);
router.post('/content/:id/seasons/:seasonNumber/episodes', addEpisode);
router.put('/content/:id/seasons/:seasonNumber/episodes/:episodeNumber', updateEpisode);
router.put('/content/:id/organization', updateContentOrganization);
router.put('/content/:id/video-assets', updateVideoAssets);

router.get('/users', listUsers);
router.get('/users/:id/behavior', getUserBehavior);
router.put('/users/:id/subscription', updateUserSubscription);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/suspension', setUserSuspension);
router.post('/users/:id/reset-password', resetUserPassword);
router.post('/users/:id/terminate', terminateUser);
router.delete('/users/:id', deleteUser);

router.get('/billing/plans', getSubscriptionPlans);
router.post('/billing/plans', upsertSubscriptionPlan);
router.get('/billing/promotions', getPromotions);
router.post('/billing/promotions', upsertPromotion);
router.post('/billing/invoices', generateInvoice);
router.get('/billing/failed-payments', listFailedPayments);

router.get('/analytics/content-performance', getContentPerformance);
router.get('/analytics/user-engagement', getUserEngagement);

module.exports = router;

const express = require('express');
const {
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
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.post('/verify-email/request', requestEmailVerification);
router.post('/verify-email/confirm', confirmEmailVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/profile', updateProfile);
router.put('/password', updatePassword);

module.exports = router;

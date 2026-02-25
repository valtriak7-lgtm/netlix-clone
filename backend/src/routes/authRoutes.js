const express = require('express');
const { register, login, updateProfile, updatePassword } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', updateProfile);
router.put('/password', updatePassword);

module.exports = router;

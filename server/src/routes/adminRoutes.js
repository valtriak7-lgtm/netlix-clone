// File purpose: Application logic for this Netflix Clone module.
const express = require('express');
const {
  listUsers,
  updateUserSubscription,
  updateUserRole,
  deleteUser,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/users', listUsers);
router.put('/users/:id/subscription', updateUserSubscription);
router.put('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

module.exports = router;

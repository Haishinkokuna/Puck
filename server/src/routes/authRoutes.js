// src/routes/authRoutes.js
//
// Routes are the MENU — they list what the stall offers and
// which chef (controller function) handles each order.
// No logic lives here. Just: "this URL → this function."
//
// express-validator rules are defined inline with the route.
// Why here and not in the controller?
// Because the route IS the contract boundary — validation should
// happen at the entry point, before business logic runs.
// (Separation of Concerns)

const { Router } = require('express');
const { body }   = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { register, login, getMe, leaderboard } = require('../controllers/authController');

const router = Router();

// POST /api/v1/auth/register
// Validation rules: username (3-50 chars), valid email, password min 8 chars
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be 3–50 characters.'),
    body('email')
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('A valid email is required.'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
  ],
  register  // ← the controller function that runs after validation
);

// POST /api/v1/auth/login
router.post(
  '/login',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required.'),
    body('password').notEmpty().withMessage('Password required.'),
  ],
  login
);

// GET /api/v1/users/me — protected, requires valid JWT
router.get('/me', authenticate, getMe);

// GET /api/v1/users/leaderboard — protected
router.get('/leaderboard', authenticate, leaderboard);

module.exports = router;

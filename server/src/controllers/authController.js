// src/controllers/authController.js
//
// Controllers contain BUSINESS LOGIC — the "what to do" instructions.
// They coordinate between: validation → model → response.
// They do NOT write SQL (that's the model's job).
// They do NOT define URLs (that's the router's job).
// (Single Responsibility Principle in action)

const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { findUserByEmail, createUser, findUserById, getLeaderboard } = require('../models/userModel');

// ─────────────────────────────────────────────────────
// HELPER: createTokenPayload
// Why a helper? Because we sign tokens in both register AND login.
// Centralising it means if we change the payload shape, we fix it once.
// ─────────────────────────────────────────────────────
const signToken = (userId, email) => {
  // The payload is what gets encoded inside the JWT.
  // We store only userId and email — the MINIMUM needed to identify the user.
  // We do NOT store the password, XP, or level in the token.
  // Why? Because tokens are not updated when data changes — they'd go stale.
  // The controller always re-fetches fresh data from the DB using userId.
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─────────────────────────────────────────────────────
// POST /api/v1/auth/register
// The "new customer signs up for a loyalty card" flow
// ─────────────────────────────────────────────────────
const register = async (req, res, next) => {
  // express-validator checks ran in the route definition before this controller.
  // If any field failed validation, we return ALL errors at once.
  // Why all at once? Better UX — user sees all problems, not just the first one.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', status: 400, details: errors.array() }
    });
  }

  try {
    const { username, email, password } = req.body;

    // Check if this email is already registered.
    // Why check here and not rely on the DB unique constraint?
    // Because a DB unique violation throws a generic error — we'd have to
    // parse the error message string to know what conflicted. That's fragile.
    // Checking explicitly gives us a clean, specific error code.
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', status: 409 }
      });
    }

    // Hash the password with bcrypt before EVER touching the database.
    // Salt rounds = 12: this makes the hash computation take ~250ms.
    // Why deliberately slow? To make brute-force attacks impractical.
    // If someone steals our DB, cracking one password takes 250ms × millions of guesses.
    const passwordHash = await bcrypt.hash(password, 12);

    // Create the user row. The model returns safe fields only (no password_hash).
    const newUser = await createUser({ username, email, passwordHash });

    // Sign a JWT so the user is immediately logged in after registration.
    const token = signToken(newUser.id, newUser.email);

    // 201 = "Created" — a new resource was created successfully.
    return res.status(201).json({
      user: {
        id:         newUser.id,
        username:   newUser.username,
        email:      newUser.email,
        total_xp:   newUser.total_xp,
        level:      1,              // always starts at Level 1
        title:      'Novice Scribe',
        class_name: 'Peasant',
        preferred_lang: newUser.preferred_lang,
      },
      token,
    });

  } catch (err) {
    // Pass any unexpected errors to our global error handler middleware.
    // We never try/catch every possible DB error here — too much code.
    // The global handler deals with anything we didn't anticipate.
    next(err);
  }
};

// ─────────────────────────────────────────────────────
// POST /api/v1/auth/login
// The "returning customer shows their ID" flow
// ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', status: 400, details: errors.array() }
    });
  }

  try {
    const { email, password } = req.body;

    // Fetch the user. If not found, we return a GENERIC error message.
    // Why generic? If we said "email not found" vs "wrong password" separately,
    // an attacker could use our API to enumerate valid email addresses.
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', status: 401 }
      });
    }

    // bcrypt.compare() hashes the submitted password the SAME WAY as the stored hash
    // and compares them. We never "un-hash" the stored value — that's mathematically impossible.
    // This is why bcrypt is safe: even if you know the algorithm, you can't reverse it.
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.', status: 401 }
      });
    }

    const token = signToken(user.id, user.email);

    return res.status(200).json({
      user: {
        id:           user.id,
        username:     user.username,
        email:        user.email,
        total_xp:     user.total_xp,
        level:        user.level_number,
        title:        user.title,
        class_name:   user.class_name,
        preferred_lang: user.preferred_lang,
      },
      token,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────
// GET /api/v1/users/me
// Returns the full profile of the currently logged-in user.
// req.user.userId was attached by the authenticate middleware.
// ─────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found.', status: 404 }
      });
    }
    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────
// GET /api/v1/users/leaderboard
// ─────────────────────────────────────────────────────
const leaderboard = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const entries = await getLeaderboard(Math.min(limit, 50)); // cap at 50
    return res.status(200).json({ leaderboard: entries });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, leaderboard };

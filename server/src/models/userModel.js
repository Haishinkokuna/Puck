// src/models/userModel.js
//
// This file is the ONLY place that writes SQL touching the users table.
// Controllers never write SQL — they call these functions.
//
// Why this separation?
// If we change the DB schema (e.g., rename a column), we fix it HERE only.
// Every controller that uses this function automatically gets the fix.
// (Dependency Inversion: controllers depend on this abstraction, not raw SQL)

const { query } = require('../config/db');

// ─────────────────────────────────────────────────────
// findUserByEmail
// Used during LOGIN to check if the user exists.
// Returns the full user row including password_hash so
// the auth controller can compare it with bcrypt.
// ─────────────────────────────────────────────────────
const findUserByEmail = async (email) => {
  const result = await query(
    `SELECT u.*, l.level_number, l.title, l.class_name, l.xp_required
     FROM users u
     JOIN levels l ON u.current_level_id = l.id
     WHERE u.email = $1`,
    [email]
  );
  // result.rows is an array — [0] gets the first (and only) match, or undefined
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// findUserById
// Used when the auth middleware has decoded a JWT and we
// need to fetch the full user record for a protected route.
// Notice we JOIN levels here too — every user query returns
// level data in the same call. No N+1 problem.
// ─────────────────────────────────────────────────────
const findUserById = async (id) => {
  // We calculate xp_to_next here in SQL to avoid doing math in JavaScript.
  // SQL is better at set-based math; JS is better at presentation logic.
  const result = await query(
    `SELECT
       u.id, u.username, u.email, u.total_xp, u.avatar_url, u.preferred_lang,
       u.created_at,
       l.level_number,
       l.title,
       l.class_name,
       l.xp_required  AS xp_this_level,
       -- Get the next level's xp_required for the progress bar calculation
       next_l.xp_required - u.total_xp AS xp_to_next_level,
       next_l.xp_required              AS next_level_xp
     FROM users u
     JOIN levels l      ON u.current_level_id = l.id
     -- LEFT JOIN because level 10 has no "next level" — we don't want it to disappear
     LEFT JOIN levels next_l ON next_l.level_number = l.level_number + 1
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// createUser
// Called during REGISTRATION.
// We insert the user with their hashed password and Level 1 defaults.
// We return only safe fields — never return password_hash to a controller.
// ─────────────────────────────────────────────────────
const createUser = async ({ username, email, passwordHash }) => {
  const result = await query(
    `INSERT INTO users (username, email, password_hash, total_xp, current_level_id)
     VALUES ($1, $2, $3, 0, 1)
     RETURNING id, username, email, total_xp, current_level_id, preferred_lang, created_at`,
    [username, email, passwordHash]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────────────
// getLeaderboard
// Returns the top N users by total_xp with their level info.
// Used for the leaderboard feature.
// ─────────────────────────────────────────────────────
const getLeaderboard = async (limit = 10) => {
  const result = await query(
    `SELECT
       u.username, u.total_xp, u.avatar_url,
       l.level_number, l.title, l.class_name,
       RANK() OVER (ORDER BY u.total_xp DESC) AS rank
     FROM users u
     JOIN levels l ON u.current_level_id = l.id
     ORDER BY u.total_xp DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = { findUserByEmail, findUserById, createUser, getLeaderboard };

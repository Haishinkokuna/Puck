// src/config/db.js
//
// Why a connection POOL and not a single connection?
// Because our API will handle many requests simultaneously.
// A single connection would process them one-by-one (a queue).
// A pool of 10 connections handles 10 requests in parallel.
// Think of it like 10 phone lines vs. 1 phone line at a call centre.
//
// We export the pool instance so every model can import and use it.
// This is Dependency Inversion: models depend on this abstraction,
// not on creating their own pg connections directly.

const { Pool } = require('pg');

// dotenv loads our .env file values into process.env.
// We call this here (in the first config file loaded) so that
// every subsequent file in the app can read process.env.* values.
require('dotenv').config();

// Create one pool instance for the entire application.
// The Pool constructor reads connection settings and manages
// opening/closing/recycling connections automatically.
const pool = new Pool({
  host:     process.env.DB_HOST,      // 'localhost' (or 'postgres' inside Docker)
  port:     process.env.DB_PORT,      // 5432
  database: process.env.DB_NAME,      // 'betterkanban'
  user:     process.env.DB_USER,      // 'kanban_user'
  password: process.env.DB_PASSWORD,  // from .env — never hardcoded

  // Performance settings:
  max:              10,   // maximum 10 simultaneous DB connections
  idleTimeoutMillis: 30000, // close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // fail fast if DB is unreachable (2 seconds)
});

// Listen for unexpected pool-level errors.
// Without this, a surprise DB disconnect would CRASH the entire Node process.
// With this, we log it and keep running — the pool will reconnect automatically.
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// A helper function used in every model.
// Why wrap pool.query? So we can add logging or tracing in ONE place later
// without touching every single model file. (Open/Closed Principle)
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // In development, log every query so I can debug slow queries easily
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] query="${text.substring(0, 60)}..." duration=${duration}ms rows=${result.rowCount}`);
  }

  return result;
};

// getClient() is used for TRANSACTIONS — when multiple queries
// must all succeed or all fail together (like the XP engine).
// We need to hold the same connection for the whole transaction,
// so we can't use the pool's auto-managed query() for that.
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };

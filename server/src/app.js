// src/app.js
//
// This is the entry point of the entire Express server.
// Its job is to ASSEMBLE all the parts we built in isolation:
//   config → middleware → routes → error handler → listen
//
// Think of it like the head kitchen manager who:
// 1. Unlocks the building (loads env)
// 2. Sets up the security checkpoints (middleware)
// 3. Pins the menu to the wall (routes)
// 4. Posts the complaint form on the door (error handler)
// 5. Opens the doors (server.listen)

require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes    = require('./routes/authRoutes');
const boardRoutes   = require('./routes/boardRoutes');
const skillRoutes   = require('./routes/skillRoutes');
const taskTypeRoutes = require('./routes/taskTypeRoutes');
const { pool }      = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────────────
// MIDDLEWARE STACK
// These run on EVERY request in the order they are registered.
// ─────────────────────────────────────────────────────

// helmet() sets secure HTTP headers automatically.
// Example: prevents browsers from sniffing content type,
// disables old IE's dangerous X-Powered-By header, etc.
// One line of code, many security wins.
app.use(helmet());

// cors() controls which client origins can talk to this API.
// In development: allow localhost:5173 (Vite) and localhost:3000 (CRA).
// In production: we'll lock this to our actual domain.
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL          // locked to our deployed frontend
    : ['http://localhost:5173', 'http://localhost:3000'], // Vite dev server
  credentials: true,                  // allow cookies and Authorization headers
}));

// express.json() parses incoming request bodies as JSON.
// Without this, req.body would always be undefined.
// We cap it at 10kb — no one needs to send more than that to our API.
app.use(express.json({ limit: '10kb' }));

// ─────────────────────────────────────────────────────
// HEALTH CHECK
// A simple endpoint that returns 200 OK with no auth required.
// Used by Docker healthchecks and Kubernetes liveness probes
// to confirm the server is alive and accepting requests.
// ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:  'ok',
    service: 'puck-api',
    time:    new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────
// ROUTES
// Each router is mounted at its base path.
// The router handles the rest of the URL after the base.
// e.g., authRoutes handles /register → full path = /api/v1/auth/register
// e.g., authRoutes handles /me       → full path = /api/v1/users/me
// ─────────────────────────────────────────────────────
app.use('/api/v1/auth',   authRoutes);
app.use('/api/v1/users',  authRoutes);   // /me and /leaderboard
app.use('/api/v1/boards', boardRoutes);  // all board, column, task routes
app.use('/api/v1/skills', skillRoutes);
app.use('/api/v1/task-types', taskTypeRoutes);

// 404 handler — catches any URL that didn't match a route above
app.use((req, res) => {
  res.status(404).json({
    error: {
      code:    'NOT_FOUND',
      message: `Route ${req.method} ${req.url} does not exist.`,
      status:  404,
    },
  });
});

// ─────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// Must be registered LAST — Express identifies it by the 4-param signature.
// All next(err) calls from any controller land here.
// ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────
// START THE SERVER
// We test the DB connection BEFORE starting to listen.
// Why? If the DB is down, we want to fail loudly on boot,
// not silently fail on the first real request.
// ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    // Test DB connectivity — a cheap query that always returns 1 row
    await pool.query('SELECT 1');
    console.log('[DB] Connected to PostgreSQL ✓');

    app.listen(PORT, () => {
      console.log(`[SERVER] Puck API running on http://localhost:${PORT}`);
      console.log(`[SERVER] Health check: http://localhost:${PORT}/health`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    // If we can't connect to the DB on boot, crash intentionally.
    // A server running without a DB connection is useless and misleading.
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    process.exit(1); // exit code 1 = failure (Docker/K8s will restart us)
  }
};

startServer();

module.exports = app; // exported for future testing

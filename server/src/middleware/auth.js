// src/middleware/auth.js
//
// This middleware guards every [AUTH] route defined in our API contract.
// It runs BEFORE the controller — if it fails, the controller never runs.
//
// Why middleware and not inside every controller?
// Because writing the same token-check in 20 different controllers violates DRY.
// One middleware, applied once per route group. (Single Responsibility Principle)

const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // The client sends the token in the Authorization header like this:
  // Authorization: Bearer eyJhbGci...
  // We split on ' ' to get just the token part after "Bearer "
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // If no token was sent at all, reject immediately.
  // 401 = "I don't know who you are" (no credentials provided)
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'NO_TOKEN',
        message: 'Authentication token required.',
        status: 401,
      },
    });
  }

  // jwt.verify() checks two things simultaneously:
  // 1. Was this token signed with OUR secret? (prevents forgery)
  // 2. Has it expired? (JWT_EXPIRES_IN=7d from .env)
  // If either check fails, it throws an error — we catch it below.
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // 403 = "I know who you are, but you're not allowed in right now"
      // (valid token format but expired or tampered with)
      return res.status(403).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is invalid or has expired.',
          status: 403,
        },
      });
    }

    // Token is valid. Attach the decoded payload to the request object.
    // The payload contains: { userId, email, iat, exp }
    // Every controller downstream can now read req.user.userId
    // without decoding the token again. We decode ONCE here.
    req.user = decoded;
    next(); // pass control to the next handler (the controller)
  });
};

module.exports = { authenticate };

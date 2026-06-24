// src/middleware/errorHandler.js
//
// Express recognises this as a global error handler because it has
// FOUR parameters: (err, req, res, next). The extra 'err' param is the signal.
//
// Why a central handler?
// Without this, an unhandled error in any controller would either:
// a) Crash the entire Node process
// b) Hang the request forever (client waits, times out)
// With this, every error — expected or not — returns a clean JSON response.
// (Single Responsibility: error formatting lives in one place only)

const errorHandler = (err, req, res, next) => {
  // Log the full error server-side so we can debug it.
  // We NEVER expose raw stack traces to the client — that reveals
  // internal file paths and logic, which is a security risk.
  console.error(`[ERROR] ${req.method} ${req.url} →`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack); // only show stack traces in dev
  }

  // If the error has a statusCode we set deliberately (e.g., from a controller),
  // use that. Otherwise default to 500 (Internal Server Error).
  const status = err.statusCode || err.status || 500;

  res.status(status).json({
    error: {
      code:    err.code    || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred.',
      status,
    },
  });
};

module.exports = { errorHandler };

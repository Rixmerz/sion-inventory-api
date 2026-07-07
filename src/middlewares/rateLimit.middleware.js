const rateLimit = require('express-rate-limit');
const { getConfig } = require('../config/env');

const createGeneralRateLimiter = () => {
  const config = getConfig();
  return rateLimit({
    windowMs: config.generalRateLimitWindowMs,
    limit: config.generalRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMIT',
          message: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
          details: []
        }
      })
  });
};

module.exports = { createGeneralRateLimiter };

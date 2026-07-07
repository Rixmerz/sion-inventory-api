const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { getConfig } = require('../config/env');

const safeEqual = (received, expected) => {
  const receivedBuffer = Buffer.from(String(received || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
};

const apiKeyMiddleware = (req, _res, next) => {
  const expected = getConfig().trackingApiKey;
  const received = req.get('X-API-Key');
  if (!expected || !safeEqual(received, expected)) {
    return next(ApiError.unauthorized());
  }
  return next();
};

module.exports = { apiKeyMiddleware, safeEqual };

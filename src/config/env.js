const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const booleanFromEnv = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const getConfig = () => ({
  port: numberFromEnv('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  trackingUserId: process.env.TRACKING_USER_ID || 'usuario-principal',
  trackingApiKey: process.env.TRACKING_API_KEY || '',
  locationStaleSeconds: numberFromEnv('LOCATION_STALE_SECONDS', 120),
  locationMinIntervalSeconds: numberFromEnv('LOCATION_MIN_INTERVAL_SECONDS', 5),
  generalRateLimitWindowMs: numberFromEnv('GENERAL_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  generalRateLimitMax: numberFromEnv('GENERAL_RATE_LIMIT_MAX', 300),
  otelEnabled: booleanFromEnv('OTEL_ENABLED', false)
});

module.exports = { getConfig, numberFromEnv, booleanFromEnv };

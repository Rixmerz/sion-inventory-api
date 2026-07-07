const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const { getConfig } = require('./config/env');
const { loadOpenApiDocument } = require('./config/swagger');
const { createGeneralRateLimiter } = require('./middlewares/rateLimit.middleware');
const notFound = require('./middlewares/notFound.middleware');
const { errorHandler } = require('./middlewares/errorHandler.middleware');
const { getTraceContext } = require('./observability/tracing');

const createApp = () => {
  const app = express();
  const config = getConfig();
  const openApiDocument = loadOpenApiDocument();

  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: false
    })
  );
  app.use(express.json({ limit: '100kb' }));

  morgan.token('trace-id', () => getTraceContext().trace_id || '-');
  if (config.nodeEnv !== 'test') {
    app.use(morgan(':method :url :status :response-time ms trace=:trace-id'));
    app.use(createGeneralRateLimiter());
  }

  app.get('/api-docs.json', (_req, res) => res.json(openApiDocument));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { explorer: true }));
  app.use('/api/v1', routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };

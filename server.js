require('dotenv').config();

const http = require('http');
const { startTelemetry, shutdownTelemetry } = require('./src/observability/telemetry');

let httpServer;
let shuttingDown = false;

const bootstrap = async () => {
  await startTelemetry();

  // Estas importaciones se realizan después de iniciar OpenTelemetry.
  const { createApp } = require('./src/app');
  const { connectDatabase, disconnectDatabase } = require('./src/config/database');
  const { initializeSocket, closeSocket } = require('./src/config/socket');
  const { getConfig } = require('./src/config/env');

  const config = getConfig();
  await connectDatabase(config.mongodbUri);

  const app = createApp();
  httpServer = http.createServer(app);
  initializeSocket(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(config.port, resolve);
  });

  console.log(`API SION disponible en http://localhost:${config.port}`);
  console.log(`Swagger UI disponible en http://localhost:${config.port}/api-docs`);

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Cierre ordenado iniciado por ${signal}`);

    try {
      await closeSocket();
      if (httpServer?.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await disconnectDatabase();
      await shutdownTelemetry();
      process.exit(0);
    } catch (error) {
      console.error('Error durante el cierre ordenado:', error.message);
      process.exit(1);
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch(async (error) => {
  console.error('No fue posible iniciar la API:', error.message);
  await shutdownTelemetry();
  process.exit(1);
});

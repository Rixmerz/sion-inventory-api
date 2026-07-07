const { Server } = require('socket.io');
const { getConfig } = require('./env');
const { safeEqual } = require('../middlewares/apiKey.middleware');

let io = null;

const authenticateSocket = (expectedApiKey) => (socket, next) => {
  const apiKey = socket.handshake.auth?.apiKey;
  if (!expectedApiKey || !safeEqual(apiKey, expectedApiKey)) {
    return next(new Error('INVALID_API_KEY'));
  }
  return next();
};

const initializeSocket = (httpServer) => {
  const config = getConfig();
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  io.use(authenticateSocket(config.trackingApiKey));
  io.on('connection', (socket) => {
    socket.emit('conexion:lista', { ok: true, message: 'Canal de ubicación conectado' });
  });

  return io;
};

const getIO = () => io;

const closeSocket = async () => {
  if (io) {
    await new Promise((resolve) => io.close(resolve));
    io = null;
  }
};

module.exports = { authenticateSocket, initializeSocket, getIO, closeSocket };

const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const connectDatabase = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    throw ApiError.serviceUnavailable('MONGODB_URI no está configurada');
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10
  });

  return mongoose.connection;
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

const getDatabaseStatus = () => {
  const states = {
    0: 'DISCONNECTED',
    1: 'CONNECTED',
    2: 'CONNECTING',
    3: 'DISCONNECTING'
  };
  return states[mongoose.connection.readyState] || 'UNKNOWN';
};

module.exports = { connectDatabase, disconnectDatabase, getDatabaseStatus };

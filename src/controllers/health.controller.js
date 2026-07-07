const { getDatabaseStatus } = require('../config/database');
const { success } = require('../utils/response');

const health = (_req, res) =>
  success(
    res,
    {
      service: 'sion-inventory-api',
      status: 'UP',
      database: getDatabaseStatus(),
      timestamp: new Date().toISOString()
    },
    'Servicio operativo'
  );

module.exports = { health };

const movementService = require('../services/movimiento.service');
const { success, paginated } = require('../utils/response');

const listMovements = async (req, res) => {
  const result = await movementService.listMovements(req.validated.query);
  return paginated(res, result.items, result.meta);
};

const getMovement = async (req, res) => {
  const movement = await movementService.getMovementById(req.params.movimientoId);
  return success(res, movement, 'Movimiento obtenido correctamente');
};

const listProductMovements = async (req, res) => {
  const result = await movementService.listMovements(req.validated.query, req.params.productoId);
  return paginated(res, result.items, result.meta);
};

module.exports = { listMovements, getMovement, listProductMovements };

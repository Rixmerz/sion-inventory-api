const inventoryService = require('../services/inventario.service');
const { success, paginated } = require('../utils/response');

const registerMovement = async (req, res) => {
  const result = await inventoryService.registerMovement(req.validated.body);
  return success(res, result, 'Movimiento registrado correctamente', 201);
};

const getLowStock = async (req, res) => {
  const result = await inventoryService.getLowStock(req.validated.query);
  return paginated(res, result.items, result.meta);
};

const getSummary = async (_req, res) => {
  const summary = await inventoryService.getInventorySummary();
  return success(res, summary, 'Resumen de inventario obtenido correctamente');
};

module.exports = { registerMovement, getLowStock, getSummary };

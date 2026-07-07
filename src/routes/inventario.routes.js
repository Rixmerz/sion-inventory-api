const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const inventoryController = require('../controllers/inventario.controller');
const { movimientoSchema, lowStockQuerySchema } = require('../validators/movimiento.validator');

const router = express.Router();

router.post('/movimientos', validate(movimientoSchema), asyncHandler(inventoryController.registerMovement));
router.get('/stock-bajo', validate(lowStockQuerySchema, 'query'), asyncHandler(inventoryController.getLowStock));
router.get('/resumen', asyncHandler(inventoryController.getSummary));

module.exports = router;

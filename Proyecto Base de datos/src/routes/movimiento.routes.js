const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const validarObjectId = require('../middlewares/validarObjectId.middleware');
const movementController = require('../controllers/movimiento.controller');
const { listMovimientoQuerySchema } = require('../validators/movimiento.validator');

const router = express.Router();

router.get('/', validate(listMovimientoQuerySchema, 'query'), asyncHandler(movementController.listMovements));
router.get(
  '/producto/:productoId',
  validarObjectId('productoId'),
  validate(listMovimientoQuerySchema, 'query'),
  asyncHandler(movementController.listProductMovements)
);
router.get(
  '/:movimientoId',
  validarObjectId('movimientoId'),
  asyncHandler(movementController.getMovement)
);

module.exports = router;

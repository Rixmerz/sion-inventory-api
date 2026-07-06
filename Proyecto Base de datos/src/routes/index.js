const express = require('express');
const productRoutes = require('./producto.routes');
const inventoryRoutes = require('./inventario.routes');
const movementRoutes = require('./movimiento.routes');
const locationRoutes = require('./ubicacion.routes');
const { health } = require('../controllers/health.controller');

const router = express.Router();

router.get('/health', health);
router.use('/productos', productRoutes);
router.use('/inventario', inventoryRoutes);
router.use('/movimientos', movementRoutes);
router.use('/ubicacion', locationRoutes);

module.exports = router;

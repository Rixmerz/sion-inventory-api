const Movimiento = require('../models/Movimiento');
const ApiError = require('../utils/ApiError');

const buildMovementFilter = (query) => {
  const filter = {};
  if (query.tipo) filter.tipo = query.tipo;
  if (query.productoId) filter.producto = query.productoId;
  if (query.sku) filter.sku = query.sku;
  if (query.desde || query.hasta) {
    filter.createdAt = {};
    if (query.desde) filter.createdAt.$gte = new Date(query.desde);
    if (query.hasta) filter.createdAt.$lte = new Date(query.hasta);
  }
  return filter;
};

const listMovements = async (query, forcedProductId = null) => {
  const filter = buildMovementFilter({ ...query, productoId: forcedProductId || query.productoId });
  const skip = (query.page - 1) * query.limit;
  const sort = { createdAt: query.order === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    Movimiento.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .populate('producto', 'nombre categoria precio')
      .lean(),
    Movimiento.countDocuments(filter)
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit)
    }
  };
};

const getMovementById = async (movimientoId) => {
  const movement = await Movimiento.findById(movimientoId).populate('producto', 'nombre categoria precio').lean();
  if (!movement) throw ApiError.notFound('Movimiento no encontrado', 'MOVEMENT_NOT_FOUND');
  return movement;
};

module.exports = { buildMovementFilter, listMovements, getMovementById };

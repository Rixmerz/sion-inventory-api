const mongoose = require('mongoose');
const Producto = require('../models/Producto');
const Movimiento = require('../models/Movimiento');
const ApiError = require('../utils/ApiError');
const { withSpan } = require('../observability/tracing');
const {
  recordMovement,
  recordMovementFailure,
  setLowStockValue
} = require('../observability/metrics');

const calculateMovement = (stockAnterior, payload) => {
  if (payload.tipo === 'ENTRADA') {
    return {
      stockNuevo: stockAnterior + payload.cantidad,
      cantidad: payload.cantidad,
      direccionAjuste: null
    };
  }

  if (payload.tipo === 'SALIDA') {
    if (payload.cantidad > stockAnterior) {
      throw ApiError.conflict('Stock insuficiente para realizar la salida', 'INSUFFICIENT_STOCK');
    }
    return {
      stockNuevo: stockAnterior - payload.cantidad,
      cantidad: payload.cantidad,
      direccionAjuste: null
    };
  }

  const difference = payload.stockObjetivo - stockAnterior;
  if (difference === 0) {
    throw ApiError.unprocessable('El ajuste no produce cambios en el stock', 'INVALID_ADJUSTMENT');
  }
  return {
    stockNuevo: payload.stockObjetivo,
    cantidad: Math.abs(difference),
    direccionAjuste: difference > 0 ? 'AUMENTO' : 'DISMINUCION'
  };
};

const registerMovement = async (payload) =>
  withSpan('sion.inventory.movement', { 'sion.movement.type': payload.tipo }, async () => {
    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        await withSpan('sion.mongodb.transaction', null, async () => {
          const product = await Producto.findById(payload.productoId).session(session);
          if (!product) throw ApiError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
          if (!product.activo) throw ApiError.unprocessable('El producto está inactivo', 'INACTIVE_PRODUCT');

          const variant = product.variantes.id(payload.varianteId);
          if (!variant) throw ApiError.notFound('Variante no encontrada', 'VARIANT_NOT_FOUND');
          if (!variant.activo) throw ApiError.unprocessable('La variante está inactiva', 'INACTIVE_VARIANT');

          const stockAnterior = variant.stock;
          const calculation = calculateMovement(stockAnterior, payload);
          variant.stock = calculation.stockNuevo;
          await product.save({ session });

          const [movement] = await Movimiento.create(
            [
              {
                producto: product._id,
                variante: variant._id,
                sku: variant.sku,
                tipo: payload.tipo,
                cantidad: calculation.cantidad,
                direccionAjuste: calculation.direccionAjuste,
                stockAnterior,
                stockNuevo: calculation.stockNuevo,
                motivo: payload.motivo || ''
              }
            ],
            { session }
          );

          result = {
            movimiento: movement,
            productoId: product._id,
            varianteId: variant._id,
            sku: variant.sku,
            stockAnterior,
            stockNuevo: calculation.stockNuevo
          };
        });
      });

      recordMovement(payload.tipo, 'success');
      return result;
    } catch (error) {
      recordMovement(payload.tipo, 'failure');
      recordMovementFailure(payload.tipo, error.code ? 'business_rule' : 'unexpected');
      throw error;
    } finally {
      await session.endSession();
    }
  });

const getLowStock = async ({ page, limit, categoria, incluirAgotados }) => {
  const matchProduct = { activo: true };
  if (categoria) matchProduct.categoria = categoria;

  const variantMatch = {
    'variantes.activo': true,
    $expr: { $lte: ['$variantes.stock', '$variantes.stockMinimo'] }
  };
  if (!incluirAgotados) variantMatch['variantes.stock'] = { $gt: 0 };

  const [result] = await Producto.aggregate([
    { $match: matchProduct },
    { $unwind: '$variantes' },
    { $match: variantMatch },
    { $sort: { 'variantes.stock': 1, nombre: 1 } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              productoId: '$_id',
              nombre: 1,
              categoria: 1,
              precio: 1,
              varianteId: '$variantes._id',
              sku: '$variantes.sku',
              talla: '$variantes.talla',
              color: '$variantes.color',
              stock: '$variantes.stock',
              stockMinimo: '$variantes.stockMinimo',
              estadoStock: {
                $cond: [{ $eq: ['$variantes.stock', 0] }, 'AGOTADO', 'BAJO']
              }
            }
          }
        ],
        total: [{ $count: 'value' }]
      }
    }
  ]);

  const total = result?.total?.[0]?.value || 0;
  setLowStockValue(total);
  return {
    items: result?.data || [],
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getInventorySummary = async () =>
  withSpan('sion.inventory.summary', null, async () => {
    const [summary] = await Producto.aggregate([
      { $match: { activo: true } },
      {
        $facet: {
          products: [{ $count: 'value' }],
          variants: [
            { $unwind: '$variantes' },
            { $match: { 'variantes.activo': true } },
            {
              $group: {
                _id: null,
                totalVariantesActivas: { $sum: 1 },
                unidadesDisponibles: { $sum: '$variantes.stock' },
                variantesConStockBajo: {
                  $sum: {
                    $cond: [{ $lte: ['$variantes.stock', '$variantes.stockMinimo'] }, 1, 0]
                  }
                },
                variantesAgotadas: {
                  $sum: { $cond: [{ $eq: ['$variantes.stock', 0] }, 1, 0] }
                },
                valorEstimadoInventario: {
                  $sum: { $multiply: ['$precio', '$variantes.stock'] }
                }
              }
            }
          ]
        }
      }
    ]);

    const values = summary?.variants?.[0] || {};
    const data = {
      totalProductosActivos: summary?.products?.[0]?.value || 0,
      totalVariantesActivas: values.totalVariantesActivas || 0,
      unidadesDisponibles: values.unidadesDisponibles || 0,
      variantesConStockBajo: values.variantesConStockBajo || 0,
      variantesAgotadas: values.variantesAgotadas || 0,
      valorEstimadoInventario: values.valorEstimadoInventario || 0
    };
    setLowStockValue(data.variantesConStockBajo);
    return data;
  });

module.exports = { calculateMovement, registerMovement, getLowStock, getInventorySummary };

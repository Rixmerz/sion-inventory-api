jest.mock('../../src/models/Producto', () => ({
  findById: jest.fn(),
  aggregate: jest.fn()
}));
jest.mock('../../src/models/Movimiento', () => ({ create: jest.fn() }));
jest.mock('../../src/observability/tracing', () => ({
  withSpan: jest.fn((_name, _attributes, operation) => operation({}))
}));
jest.mock('../../src/observability/metrics', () => ({
  recordMovement: jest.fn(),
  recordMovementFailure: jest.fn(),
  setLowStockValue: jest.fn()
}));

const mongoose = require('mongoose');
const Producto = require('../../src/models/Producto');
const Movimiento = require('../../src/models/Movimiento');
const metrics = require('../../src/observability/metrics');
const service = require('../../src/services/inventario.service');

const PRODUCT_ID = '64f000000000000000000001';
const VARIANT_ID = '64f000000000000000000002';

const createSession = () => ({
  withTransaction: jest.fn(async (callback) => callback()),
  endSession: jest.fn().mockResolvedValue()
});

const createProduct = ({ active = true, variantActive = true, stock = 5, hasVariant = true } = {}) => {
  const variant = hasVariant
    ? { _id: VARIANT_ID, sku: 'SKU-1', stock, activo: variantActive }
    : null;
  const variants = [];
  variants.id = jest.fn(() => variant);
  return {
    _id: PRODUCT_ID,
    activo: active,
    variantes: variants,
    save: jest.fn().mockResolvedValue()
  };
};

const mockProductQuery = (product) => {
  Producto.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(product) });
};

describe('inventario.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(createSession());
  });

  test('calcula entrada, salida y ajustes', () => {
    expect(service.calculateMovement(5, { tipo: 'ENTRADA', cantidad: 3 })).toEqual({
      stockNuevo: 8,
      cantidad: 3,
      direccionAjuste: null
    });
    expect(service.calculateMovement(5, { tipo: 'SALIDA', cantidad: 2 })).toEqual({
      stockNuevo: 3,
      cantidad: 2,
      direccionAjuste: null
    });
    expect(service.calculateMovement(5, { tipo: 'AJUSTE', stockObjetivo: 9 })).toEqual({
      stockNuevo: 9,
      cantidad: 4,
      direccionAjuste: 'AUMENTO'
    });
    expect(service.calculateMovement(5, { tipo: 'AJUSTE', stockObjetivo: 1 })).toEqual({
      stockNuevo: 1,
      cantidad: 4,
      direccionAjuste: 'DISMINUCION'
    });
  });

  test('rechaza salida insuficiente y ajuste sin cambio', () => {
    expect(() => service.calculateMovement(2, { tipo: 'SALIDA', cantidad: 3 })).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_STOCK' }));
    expect(() => service.calculateMovement(2, { tipo: 'AJUSTE', stockObjetivo: 2 })).toThrow(expect.objectContaining({ code: 'INVALID_ADJUSTMENT' }));
  });

  test('registra movimiento transaccional exitoso', async () => {
    const product = createProduct({ stock: 5 });
    mockProductQuery(product);
    Movimiento.create.mockResolvedValue([{ _id: 'movement' }]);

    const result = await service.registerMovement({
      productoId: PRODUCT_ID,
      varianteId: VARIANT_ID,
      tipo: 'ENTRADA',
      cantidad: 3,
      motivo: 'Reposición'
    });

    expect(product.variantes.id().stock).toBe(8);
    expect(product.save).toHaveBeenCalledWith(expect.objectContaining({ session: expect.any(Object) }));
    expect(Movimiento.create).toHaveBeenCalledWith(
      [expect.objectContaining({ tipo: 'ENTRADA', cantidad: 3, stockAnterior: 5, stockNuevo: 8 })],
      expect.objectContaining({ session: expect.any(Object) })
    );
    expect(result.stockNuevo).toBe(8);
    expect(metrics.recordMovement).toHaveBeenCalledWith('ENTRADA', 'success');
  });

  test.each([
    ['producto no existe', null, 'PRODUCT_NOT_FOUND'],
    ['producto inactivo', createProduct({ active: false }), 'INACTIVE_PRODUCT'],
    ['variante no existe', createProduct({ hasVariant: false }), 'VARIANT_NOT_FOUND'],
    ['variante inactiva', createProduct({ variantActive: false }), 'INACTIVE_VARIANT']
  ])('rechaza movimiento cuando %s', async (_label, product, code) => {
    mockProductQuery(product);
    await expect(service.registerMovement({
      productoId: PRODUCT_ID,
      varianteId: VARIANT_ID,
      tipo: 'ENTRADA',
      cantidad: 1
    })).rejects.toMatchObject({ code });
    expect(metrics.recordMovement).toHaveBeenCalledWith('ENTRADA', 'failure');
    expect(metrics.recordMovementFailure).toHaveBeenCalled();
  });

  test('finaliza sesión aun si falla la salida', async () => {
    const session = createSession();
    mongoose.startSession.mockResolvedValueOnce(session);
    mockProductQuery(createProduct({ stock: 0 }));
    await expect(service.registerMovement({
      productoId: PRODUCT_ID,
      varianteId: VARIANT_ID,
      tipo: 'SALIDA',
      cantidad: 1
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(session.endSession).toHaveBeenCalled();
  });

  test('obtiene stock bajo paginado y configura métrica', async () => {
    Producto.aggregate.mockResolvedValueOnce([{ data: [{ sku: 'A' }], total: [{ value: 11 }] }]);
    const result = await service.getLowStock({ page: 2, limit: 5, categoria: 'Ropa', incluirAgotados: false });
    expect(result.items).toEqual([{ sku: 'A' }]);
    expect(result.meta.totalPages).toBe(3);
    expect(metrics.setLowStockValue).toHaveBeenCalledWith(11);
    const pipeline = Producto.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { activo: true, categoria: 'Ropa' } });

    Producto.aggregate.mockResolvedValueOnce([]);
    const empty = await service.getLowStock({ page: 1, limit: 10, incluirAgotados: true });
    expect(empty.items).toEqual([]);
    expect(empty.meta.total).toBe(0);
  });

  test('obtiene resumen y valores predeterminados', async () => {
    Producto.aggregate.mockResolvedValueOnce([{
      products: [{ value: 2 }],
      variants: [{
        totalVariantesActivas: 4,
        unidadesDisponibles: 20,
        variantesConStockBajo: 1,
        variantesAgotadas: 1,
        valorEstimadoInventario: 1000
      }]
    }]);
    const result = await service.getInventorySummary();
    expect(result).toEqual({
      totalProductosActivos: 2,
      totalVariantesActivas: 4,
      unidadesDisponibles: 20,
      variantesConStockBajo: 1,
      variantesAgotadas: 1,
      valorEstimadoInventario: 1000
    });

    Producto.aggregate.mockResolvedValueOnce([]);
    await expect(service.getInventorySummary()).resolves.toEqual({
      totalProductosActivos: 0,
      totalVariantesActivas: 0,
      unidadesDisponibles: 0,
      variantesConStockBajo: 0,
      variantesAgotadas: 0,
      valorEstimadoInventario: 0
    });
  });
});

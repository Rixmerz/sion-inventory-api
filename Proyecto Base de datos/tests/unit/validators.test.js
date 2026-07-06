const {
  createProductoSchema,
  updateProductoSchema,
  listProductoQuerySchema
} = require('../../src/validators/producto.validator');
const { createVarianteSchema, updateVarianteSchema } = require('../../src/validators/variante.validator');
const {
  movimientoSchema,
  listMovimientoQuerySchema,
  lowStockQuerySchema
} = require('../../src/validators/movimiento.validator');
const { updateUbicacionSchema } = require('../../src/validators/ubicacion.validator');

const PRODUCT_ID = '64f000000000000000000001';
const VARIANT_ID = '64f000000000000000000002';

describe('Validadores Zod', () => {
  test('normaliza producto y variantes', () => {
    const parsed = createProductoSchema.parse({
      nombre: ' Polerón ',
      categoria: ' Ropa ',
      precio: 100,
      variantes: [{ sku: ' abc-1 ', talla: ' m ', color: ' Negro ' }]
    });
    expect(parsed.nombre).toBe('Polerón');
    expect(parsed.variantes[0].sku).toBe('ABC-1');
    expect(parsed.variantes[0].talla).toBe('M');
    expect(parsed.variantes[0].stockMinimo).toBe(3);
    expect(parsed.descripcion).toBe('');
  });

  test('rechaza campos desconocidos, precio negativo y actualización vacía', () => {
    expect(createProductoSchema.safeParse({ nombre: 'XX', categoria: 'YY', precio: -1 }).success).toBe(false);
    expect(createProductoSchema.safeParse({ nombre: 'XX', categoria: 'YY', precio: 1, stock: 3 }).success).toBe(false);
    expect(updateProductoSchema.safeParse({}).success).toBe(false);
    expect(updateProductoSchema.parse({ activo: false })).toEqual({ activo: false });
  });

  test('aplica defaults y transforma query de productos', () => {
    const parsed = listProductoQuerySchema.parse({ activo: 'true', order: 'asc' });
    expect(parsed).toMatchObject({ page: 1, limit: 10, activo: true, sort: 'createdAt', order: 'asc' });
  });

  test('valida creación y edición de variantes', () => {
    expect(createVarianteSchema.parse({ sku: 'sku-1', talla: 's', color: 'Azul' }).sku).toBe('SKU-1');
    expect(updateVarianteSchema.parse({ activo: false })).toEqual({ activo: false });
    expect(updateVarianteSchema.safeParse({ stock: 4 }).success).toBe(false);
    expect(updateVarianteSchema.safeParse({}).success).toBe(false);
  });

  test.each([
    ['ENTRADA', { cantidad: 3, motivo: '' }],
    ['SALIDA', { cantidad: 1, motivo: 'Venta' }],
    ['AJUSTE', { stockObjetivo: 8, motivo: 'Conteo' }]
  ])('valida movimiento %s', (tipo, extra) => {
    const parsed = movimientoSchema.parse({ productoId: PRODUCT_ID, varianteId: VARIANT_ID, tipo, ...extra });
    expect(parsed.tipo).toBe(tipo);
  });

  test('rechaza movimientos inválidos', () => {
    expect(movimientoSchema.safeParse({ productoId: 'x', varianteId: VARIANT_ID, tipo: 'ENTRADA', cantidad: 1 }).success).toBe(false);
    expect(movimientoSchema.safeParse({ productoId: PRODUCT_ID, varianteId: VARIANT_ID, tipo: 'SALIDA', cantidad: 0 }).success).toBe(false);
    expect(movimientoSchema.safeParse({ productoId: PRODUCT_ID, varianteId: VARIANT_ID, tipo: 'AJUSTE', stockObjetivo: 2, motivo: '' }).success).toBe(false);
  });

  test('valida filtros de movimientos y stock bajo', () => {
    const filters = listMovimientoQuerySchema.parse({
      page: '2',
      limit: '5',
      sku: 'sku-x',
      desde: '2026-01-01T00:00:00.000Z',
      hasta: '2026-01-02T00:00:00.000Z'
    });
    expect(filters.page).toBe(2);
    expect(filters.sku).toBe('SKU-X');
    expect(listMovimientoQuerySchema.safeParse({ desde: '2026-02-01T00:00:00Z', hasta: '2026-01-01T00:00:00Z' }).success).toBe(false);
    expect(lowStockQuerySchema.parse({ incluirAgotados: 'false' }).incluirAgotados).toBe(false);
  });

  test('valida ubicación y evita fechas lejanas en el futuro', () => {
    const valid = updateUbicacionSchema.parse({
      latitud: -33,
      longitud: -70,
      precisionMetros: 3,
      velocidadMps: 0,
      rumboGrados: 360,
      capturadaEn: new Date().toISOString()
    });
    expect(valid.latitud).toBe(-33);
    expect(updateUbicacionSchema.safeParse({ latitud: -91, longitud: 0, capturadaEn: new Date().toISOString() }).success).toBe(false);
    expect(updateUbicacionSchema.safeParse({ latitud: 0, longitud: 181, capturadaEn: new Date().toISOString() }).success).toBe(false);
    expect(updateUbicacionSchema.safeParse({ latitud: 0, longitud: 0, capturadaEn: new Date(Date.now() + 10 * 60 * 1000).toISOString() }).success).toBe(false);
  });
});

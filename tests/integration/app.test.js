const request = require('supertest');
const ApiError = require('../../src/utils/ApiError');

jest.mock('../../src/services/producto.service', () => ({
  createProduct: jest.fn(),
  listProducts: jest.fn(),
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
  deactivateProduct: jest.fn(),
  addVariant: jest.fn(),
  updateVariant: jest.fn(),
  deactivateVariant: jest.fn(),
  getProductStock: jest.fn()
}));

jest.mock('../../src/services/inventario.service', () => ({
  registerMovement: jest.fn(),
  getLowStock: jest.fn(),
  getInventorySummary: jest.fn()
}));

jest.mock('../../src/services/movimiento.service', () => ({
  listMovements: jest.fn(),
  getMovementById: jest.fn()
}));

jest.mock('../../src/services/ubicacion.service', () => ({
  updateLocation: jest.fn(),
  getLastLocation: jest.fn(),
  stopLocation: jest.fn()
}));

const productService = require('../../src/services/producto.service');
const inventoryService = require('../../src/services/inventario.service');
const movementService = require('../../src/services/movimiento.service');
const locationService = require('../../src/services/ubicacion.service');
const { createApp } = require('../../src/app');

const PRODUCT_ID = '64f000000000000000000001';
const VARIANT_ID = '64f000000000000000000002';
const MOVEMENT_ID = '64f000000000000000000003';

const product = {
  _id: PRODUCT_ID,
  nombre: 'Polerón SION',
  categoria: 'Polerones',
  precio: 34990,
  activo: true,
  variantes: []
};

const variant = {
  _id: VARIANT_ID,
  sku: 'SION-POL-NEG-M',
  talla: 'M',
  color: 'Negro',
  stock: 0,
  stockMinimo: 3,
  activo: true
};

describe('API HTTP', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    productService.createProduct.mockResolvedValue(product);
    productService.listProducts.mockResolvedValue({ items: [product], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    productService.getProductById.mockResolvedValue(product);
    productService.updateProduct.mockResolvedValue(product);
    productService.deactivateProduct.mockResolvedValue({ ...product, activo: false });
    productService.addVariant.mockResolvedValue(variant);
    productService.updateVariant.mockResolvedValue(variant);
    productService.deactivateVariant.mockResolvedValue({ ...variant, activo: false });
    productService.getProductStock.mockResolvedValue({ productoId: PRODUCT_ID, nombre: product.nombre, stockTotal: 0, variantes: [variant] });

    inventoryService.registerMovement.mockResolvedValue({ stockAnterior: 0, stockNuevo: 10 });
    inventoryService.getLowStock.mockResolvedValue({ items: [variant], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    inventoryService.getInventorySummary.mockResolvedValue({ totalProductosActivos: 1 });

    movementService.listMovements.mockResolvedValue({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
    movementService.getMovementById.mockResolvedValue({ _id: MOVEMENT_ID, tipo: 'ENTRADA' });

    locationService.updateLocation.mockResolvedValue({ usuarioId: 'usuario-principal', estado: 'ACTIVA' });
    locationService.getLastLocation.mockResolvedValue({ usuarioId: 'usuario-principal', estado: 'SIN_DATOS' });
    locationService.stopLocation.mockResolvedValue({ usuarioId: 'usuario-principal', estado: 'INACTIVA' });
  });

  test('publica health, OpenAPI JSON y Swagger UI', async () => {
    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data.service).toBe('sion-inventory-api');

    const openapi = await request(app).get('/api-docs.json');
    expect(openapi.status).toBe(200);
    expect(openapi.body.openapi).toBe('3.1.0');

    const swagger = await request(app).get('/api-docs/');
    expect(swagger.status).toBe(200);
    expect(swagger.text).toContain('Swagger UI');
  });

  test('ejecuta CRUD y stock de productos', async () => {
    const create = await request(app).post('/api/v1/productos').send({
      nombre: 'Polerón SION',
      categoria: 'Polerones',
      precio: 34990,
      variantes: []
    });
    expect(create.status).toBe(201);
    expect(productService.createProduct).toHaveBeenCalled();

    const list = await request(app).get('/api/v1/productos?activo=true&page=1&limit=10');
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);

    const get = await request(app).get(`/api/v1/productos/${PRODUCT_ID}`);
    expect(get.status).toBe(200);

    const patch = await request(app).patch(`/api/v1/productos/${PRODUCT_ID}`).send({ precio: 39990 });
    expect(patch.status).toBe(200);

    const stock = await request(app).get(`/api/v1/productos/${PRODUCT_ID}/stock`);
    expect(stock.status).toBe(200);

    const remove = await request(app).delete(`/api/v1/productos/${PRODUCT_ID}`);
    expect(remove.status).toBe(200);
    expect(remove.body.data.activo).toBe(false);
  });

  test('valida creación, actualización e identificadores', async () => {
    const invalidProduct = await request(app).post('/api/v1/productos').send({ precio: -1 });
    expect(invalidProduct.status).toBe(400);
    expect(invalidProduct.body.error.code).toBe('VALIDATION_ERROR');

    const invalidUpdate = await request(app).patch(`/api/v1/productos/${PRODUCT_ID}`).send({ stock: 5 });
    expect(invalidUpdate.status).toBe(400);

    const invalidId = await request(app).get('/api/v1/productos/no-es-id');
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe('INVALID_OBJECT_ID');
  });

  test('administra variantes', async () => {
    const create = await request(app).post(`/api/v1/productos/${PRODUCT_ID}/variantes`).send({
      sku: 'sion-pol-neg-m',
      talla: 'm',
      color: 'Negro',
      stockMinimo: 3
    });
    expect(create.status).toBe(201);
    expect(productService.addVariant.mock.calls[0][1].sku).toBe('SION-POL-NEG-M');

    const patch = await request(app)
      .patch(`/api/v1/productos/${PRODUCT_ID}/variantes/${VARIANT_ID}`)
      .send({ stockMinimo: 5 });
    expect(patch.status).toBe(200);

    const remove = await request(app).delete(`/api/v1/productos/${PRODUCT_ID}/variantes/${VARIANT_ID}`);
    expect(remove.status).toBe(200);
  });

  test('registra y consulta inventario', async () => {
    const movement = await request(app).post('/api/v1/inventario/movimientos').send({
      productoId: PRODUCT_ID,
      varianteId: VARIANT_ID,
      tipo: 'ENTRADA',
      cantidad: 10,
      motivo: 'Reposición'
    });
    expect(movement.status).toBe(201);

    const invalid = await request(app).post('/api/v1/inventario/movimientos').send({
      productoId: PRODUCT_ID,
      varianteId: VARIANT_ID,
      tipo: 'AJUSTE',
      stockObjetivo: 1,
      motivo: ''
    });
    expect(invalid.status).toBe(400);

    const low = await request(app).get('/api/v1/inventario/stock-bajo?incluirAgotados=false');
    expect(low.status).toBe(200);

    const summary = await request(app).get('/api/v1/inventario/resumen');
    expect(summary.status).toBe(200);
  });

  test('consulta movimientos y su historial por producto', async () => {
    const list = await request(app).get('/api/v1/movimientos?tipo=ENTRADA');
    expect(list.status).toBe(200);

    const one = await request(app).get(`/api/v1/movimientos/${MOVEMENT_ID}`);
    expect(one.status).toBe(200);

    const history = await request(app).get(`/api/v1/movimientos/producto/${PRODUCT_ID}?page=1&limit=10`);
    expect(history.status).toBe(200);
    expect(movementService.listMovements).toHaveBeenLastCalledWith(expect.any(Object), PRODUCT_ID);
  });

  test('protege y ejecuta endpoints de ubicación', async () => {
    const unauthorized = await request(app).get('/api/v1/ubicacion');
    expect(unauthorized.status).toBe(401);

    const update = await request(app)
      .patch('/api/v1/ubicacion')
      .set('X-API-Key', 'test-api-key')
      .send({
        latitud: -33.45,
        longitud: -70.64,
        capturadaEn: new Date().toISOString()
      });
    expect(update.status).toBe(200);

    const get = await request(app).get('/api/v1/ubicacion').set('X-API-Key', 'test-api-key');
    expect(get.status).toBe(200);

    const stop = await request(app).post('/api/v1/ubicacion/detener').set('X-API-Key', 'test-api-key');
    expect(stop.status).toBe(200);
  });

  test('normaliza errores de servicio y rutas inexistentes', async () => {
    productService.getProductById.mockRejectedValueOnce(ApiError.notFound('No existe', 'PRODUCT_NOT_FOUND'));
    const missing = await request(app).get(`/api/v1/productos/${PRODUCT_ID}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('PRODUCT_NOT_FOUND');

    const route = await request(app).get('/ruta-inexistente');
    expect(route.status).toBe(404);
    expect(route.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

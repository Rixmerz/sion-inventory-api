const http = require('http');
const mongoose = require('mongoose');
const { getConfig, numberFromEnv, booleanFromEnv } = require('../../src/config/env');
const { connectDatabase, disconnectDatabase, getDatabaseStatus } = require('../../src/config/database');
const { authenticateSocket, initializeSocket, getIO, closeSocket } = require('../../src/config/socket');
const Producto = require('../../src/models/Producto');
const Movimiento = require('../../src/models/Movimiento');
const Ubicacion = require('../../src/models/Ubicacion');
const { withSpan, getTraceContext } = require('../../src/observability/tracing');
const metrics = require('../../src/observability/metrics');

describe('Configuración, modelos y observabilidad', () => {
  test('env convierte valores y aplica defaults', () => {
    process.env.PORT = '4000';
    process.env.OTEL_ENABLED = 'true';
    expect(numberFromEnv('PORT', 1)).toBe(4000);
    process.env.INVALID_NUMBER = 'x';
    expect(numberFromEnv('INVALID_NUMBER', 7)).toBe(7);
    expect(booleanFromEnv('OTEL_ENABLED')).toBe(true);
    process.env.OTEL_ENABLED = 'FALSE';
    expect(booleanFromEnv('OTEL_ENABLED', true)).toBe(false);
    delete process.env.MISSING_BOOL;
    expect(booleanFromEnv('MISSING_BOOL', true)).toBe(true);
    expect(getConfig().port).toBe(4000);
  });

  test('database exige URI, conecta, desconecta y traduce estados', async () => {
    await expect(connectDatabase('')).rejects.toMatchObject({ code: 'DATABASE_ERROR' });
    const connectSpy = jest.spyOn(mongoose, 'connect').mockResolvedValue(mongoose.connection);
    await connectDatabase('mongodb://example.test/db');
    expect(connectSpy).toHaveBeenCalled();

    const disconnectSpy = jest.spyOn(mongoose, 'disconnect').mockResolvedValue();
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
    expect(getDatabaseStatus()).toBe('CONNECTED');
    await disconnectDatabase();
    expect(disconnectSpy).toHaveBeenCalled();
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 0 });
    await disconnectDatabase();
    expect(getDatabaseStatus()).toBe('DISCONNECTED');
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 99 });
    expect(getDatabaseStatus()).toBe('UNKNOWN');
  });

  test('autenticación WebSocket acepta y rechaza claves', () => {
    const next = jest.fn();
    authenticateSocket('key')({ handshake: { auth: { apiKey: 'key' } } }, next);
    expect(next).toHaveBeenCalledWith();

    const bad = jest.fn();
    authenticateSocket('key')({ handshake: { auth: {} } }, bad);
    expect(bad.mock.calls[0][0].message).toBe('INVALID_API_KEY');
  });

  test('inicializa y cierra Socket.IO', async () => {
    process.env.CORS_ORIGIN = '*';
    process.env.TRACKING_API_KEY = 'test-api-key';
    const server = http.createServer();
    const io = initializeSocket(server);
    expect(getIO()).toBe(io);
    await closeSocket();
    expect(getIO()).toBeNull();
  });

  test('modelos aplican defaults y validaciones', async () => {
    const product = new Producto({
      nombre: 'Polerón',
      categoria: 'Ropa',
      precio: 100,
      variantes: [{ sku: 'sku-1', talla: 'm', color: 'Negro' }]
    });
    await expect(product.validate()).resolves.toBeUndefined();
    expect(product.activo).toBe(true);
    expect(product.variantes[0].sku).toBe('SKU-1');
    expect(product.variantes[0].stock).toBe(0);

    const invalidProduct = new Producto({ nombre: 'X', categoria: 'Ropa', precio: -1 });
    await expect(invalidProduct.validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

    const movement = new Movimiento({
      producto: new mongoose.Types.ObjectId(),
      variante: new mongoose.Types.ObjectId(),
      sku: 'sku',
      tipo: 'ENTRADA',
      cantidad: 1,
      stockAnterior: 0,
      stockNuevo: 1
    });
    await expect(movement.validate()).resolves.toBeUndefined();

    const invalidMovement = new Movimiento({ tipo: 'OTRO', cantidad: 0 });
    await expect(invalidMovement.validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

    const location = new Ubicacion({
      usuarioId: 'u',
      posicion: { type: 'Point', coordinates: [-70, -33] },
      capturadaEn: new Date(),
      recibidaEn: new Date()
    });
    await expect(location.validate()).resolves.toBeUndefined();

    const invalidLocation = new Ubicacion({
      usuarioId: 'u',
      posicion: { type: 'Point', coordinates: [-70] },
      capturadaEn: new Date(),
      recibidaEn: new Date()
    });
    await expect(invalidLocation.validate()).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });

  test('tracing devuelve resultado, propaga error y contexto vacío', async () => {
    await expect(withSpan('test.success', { a: 'b' }, async () => 4)).resolves.toBe(4);
    await expect(withSpan('test.error', null, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(getTraceContext()).toEqual({});
  });

  test('métricas aceptan valores sin exponer datos de alta cardinalidad', () => {
    metrics.recordMovement('ENTRADA', 'success');
    metrics.recordMovementFailure('SALIDA', 'business_rule');
    metrics.recordLocationUpdate('rejected');
    metrics.recordApiError('VALIDATION_ERROR', '4xx');
    metrics.setLowStockValue(3);
    metrics.setLowStockValue(Number.NaN);
    metrics.setLastLocationAge(10);
    metrics.setLastLocationAge(-1);
  });
});

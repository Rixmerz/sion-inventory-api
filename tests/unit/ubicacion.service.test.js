jest.mock('../../src/models/Ubicacion', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));
jest.mock('../../src/config/socket', () => ({ getIO: jest.fn() }));
jest.mock('../../src/observability/tracing', () => ({
  withSpan: jest.fn((_name, _attrs, operation) => operation({}))
}));
jest.mock('../../src/observability/metrics', () => ({
  recordLocationUpdate: jest.fn(),
  setLastLocationAge: jest.fn()
}));

const Ubicacion = require('../../src/models/Ubicacion');
const { getIO } = require('../../src/config/socket');
const metrics = require('../../src/observability/metrics');
const service = require('../../src/services/ubicacion.service');

const NOW = new Date('2026-07-05T20:00:00.000Z');
const baseLocation = (overrides = {}) => ({
  usuarioId: 'usuario-principal',
  posicion: { type: 'Point', coordinates: [-70.64, -33.45] },
  precisionMetros: 10,
  velocidadMps: 0,
  rumboGrados: 180,
  compartiendo: true,
  capturadaEn: new Date('2026-07-05T19:59:59.000Z'),
  recibidaEn: new Date('2026-07-05T19:59:59.000Z'),
  ...overrides
});

describe('ubicacion.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRACKING_USER_ID = 'usuario-principal';
    process.env.LOCATION_STALE_SECONDS = '120';
    process.env.LOCATION_MIN_INTERVAL_SECONDS = '5';
    getIO.mockReturnValue(null);
  });

  test('determina estados de ubicación', () => {
    expect(service.getLocationState(null, NOW)).toEqual({ estado: 'SIN_DATOS', antiguedadSegundos: null });
    expect(service.getLocationState(baseLocation({ compartiendo: false }), NOW)).toEqual({ estado: 'INACTIVA', antiguedadSegundos: null });
    expect(service.getLocationState(baseLocation(), NOW)).toEqual({ estado: 'ACTIVA', antiguedadSegundos: 1 });
    expect(service.getLocationState(baseLocation({ recibidaEn: new Date('2026-07-05T19:50:00Z') }), NOW).estado).toBe('DESACTUALIZADA');
    expect(service.getLocationState(baseLocation({ recibidaEn: new Date('2026-07-05T20:01:00Z') }), NOW).antiguedadSegundos).toBe(0);
  });

  test('convierte ubicación a DTO y maneja ausencia', () => {
    expect(service.toLocationDto(null, NOW)).toEqual({
      usuarioId: 'usuario-principal',
      estado: 'SIN_DATOS',
      antiguedadSegundos: null
    });
    const dto = service.toLocationDto(baseLocation(), NOW);
    expect(dto.latitud).toBe(-33.45);
    expect(dto.longitud).toBe(-70.64);
    expect(dto.estado).toBe('ACTIVA');
    expect(metrics.setLastLocationAge).toHaveBeenCalledWith(1);
  });

  test('emite solamente cuando Socket.IO está disponible', () => {
    const io = { emit: jest.fn() };
    getIO.mockReturnValueOnce(io);
    service.emitIfAvailable('evento', { a: 1 });
    expect(io.emit).toHaveBeenCalledWith('evento', { a: 1 });
    getIO.mockReturnValueOnce(null);
    expect(() => service.emitIfAvailable('evento', {})).not.toThrow();
  });

  test('actualiza primera ubicación mediante upsert y emite evento', async () => {
    Ubicacion.findOne.mockResolvedValue(null);
    const saved = baseLocation({ recibidaEn: NOW });
    Ubicacion.findOneAndUpdate.mockResolvedValue(saved);
    const io = { emit: jest.fn() };
    getIO.mockReturnValue(io);

    const result = await service.updateLocation({
      latitud: -33.45,
      longitud: -70.64,
      precisionMetros: 10,
      capturadaEn: '2026-07-05T19:59:59.000Z'
    }, NOW);

    expect(Ubicacion.findOneAndUpdate).toHaveBeenCalledWith(
      { usuarioId: 'usuario-principal' },
      { $set: expect.objectContaining({ posicion: { type: 'Point', coordinates: [-70.64, -33.45] }, compartiendo: true, recibidaEn: NOW }) },
      expect.objectContaining({ upsert: true, new: true })
    );
    expect(result.estado).toBe('ACTIVA');
    expect(io.emit).toHaveBeenCalledWith('ubicacion:actualizada', result);
    expect(metrics.recordLocationUpdate).toHaveBeenCalledWith('success');
  });

  test('rechaza actualizaciones demasiado frecuentes', async () => {
    Ubicacion.findOne.mockResolvedValue(baseLocation({ recibidaEn: new Date('2026-07-05T19:59:58.000Z') }));
    await expect(service.updateLocation({
      latitud: -33,
      longitud: -70,
      capturadaEn: '2026-07-05T19:59:59.000Z'
    }, NOW)).rejects.toMatchObject({ code: 'LOCATION_RATE_LIMIT' });
    expect(metrics.recordLocationUpdate).toHaveBeenCalledWith('rejected');
  });

  test('actualiza campos opcionales ausentes como null', async () => {
    Ubicacion.findOne.mockResolvedValue(baseLocation({ recibidaEn: new Date('2026-07-05T19:59:00Z') }));
    Ubicacion.findOneAndUpdate.mockResolvedValue(baseLocation({
      recibidaEn: NOW,
      precisionMetros: null,
      velocidadMps: null,
      rumboGrados: null
    }));
    await service.updateLocation({ latitud: -33, longitud: -70, capturadaEn: NOW.toISOString() }, NOW);
    const set = Ubicacion.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.precisionMetros).toBeNull();
    expect(set.velocidadMps).toBeNull();
    expect(set.rumboGrados).toBeNull();
  });

  test('consulta última ubicación y estado sin datos', async () => {
    Ubicacion.findOne.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(baseLocation()) });
    await expect(service.getLastLocation(NOW)).resolves.toMatchObject({ estado: 'ACTIVA' });
    Ubicacion.findOne.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(null) });
    await expect(service.getLastLocation(NOW)).resolves.toMatchObject({ estado: 'SIN_DATOS' });
  });

  test('detiene ubicación y emite evento', async () => {
    Ubicacion.findOneAndUpdate.mockResolvedValue(baseLocation({ compartiendo: false, recibidaEn: NOW }));
    const io = { emit: jest.fn() };
    getIO.mockReturnValue(io);
    const result = await service.stopLocation(NOW);
    expect(result).toEqual({ usuarioId: 'usuario-principal', estado: 'INACTIVA', fecha: NOW });
    expect(io.emit).toHaveBeenCalledWith('ubicacion:detenida', result);
  });

  test('rechaza detener si no existe ubicación', async () => {
    Ubicacion.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.stopLocation(NOW)).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });
});

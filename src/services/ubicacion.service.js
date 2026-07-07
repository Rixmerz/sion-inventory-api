const Ubicacion = require('../models/Ubicacion');
const ApiError = require('../utils/ApiError');
const { getConfig } = require('../config/env');
const { getIO } = require('../config/socket');
const { withSpan } = require('../observability/tracing');
const { recordLocationUpdate, setLastLocationAge } = require('../observability/metrics');

const getLocationState = (location, now = new Date()) => {
  if (!location) return { estado: 'SIN_DATOS', antiguedadSegundos: null };
  if (!location.compartiendo) return { estado: 'INACTIVA', antiguedadSegundos: null };

  const reference = new Date(location.recibidaEn || location.updatedAt);
  const age = Math.max(0, Math.floor((now.getTime() - reference.getTime()) / 1000));
  const staleSeconds = getConfig().locationStaleSeconds;
  return {
    estado: age > staleSeconds ? 'DESACTUALIZADA' : 'ACTIVA',
    antiguedadSegundos: age
  };
};

const toLocationDto = (location, now = new Date()) => {
  if (!location) {
    return {
      usuarioId: getConfig().trackingUserId,
      estado: 'SIN_DATOS',
      antiguedadSegundos: null
    };
  }

  const state = getLocationState(location, now);
  setLastLocationAge(state.antiguedadSegundos || 0);
  return {
    usuarioId: location.usuarioId,
    latitud: location.posicion.coordinates[1],
    longitud: location.posicion.coordinates[0],
    precisionMetros: location.precisionMetros,
    velocidadMps: location.velocidadMps,
    rumboGrados: location.rumboGrados,
    estado: state.estado,
    capturadaEn: location.capturadaEn,
    recibidaEn: location.recibidaEn,
    antiguedadSegundos: state.antiguedadSegundos
  };
};

const emitIfAvailable = (event, payload) => {
  const io = getIO();
  if (io) io.emit(event, payload);
};

const updateLocation = async (payload, now = new Date()) =>
  withSpan('sion.location.update', null, async () => {
    const config = getConfig();
    try {
      const existing = await Ubicacion.findOne({ usuarioId: config.trackingUserId });
      if (existing?.recibidaEn) {
        const elapsed = (now.getTime() - new Date(existing.recibidaEn).getTime()) / 1000;
        if (elapsed < config.locationMinIntervalSeconds) {
          throw ApiError.tooManyRequests(
            `Debe esperar al menos ${config.locationMinIntervalSeconds} segundos entre actualizaciones`,
            'LOCATION_RATE_LIMIT'
          );
        }
      }

      const location = await Ubicacion.findOneAndUpdate(
        { usuarioId: config.trackingUserId },
        {
          $set: {
            posicion: { type: 'Point', coordinates: [payload.longitud, payload.latitud] },
            precisionMetros: payload.precisionMetros ?? null,
            velocidadMps: payload.velocidadMps ?? null,
            rumboGrados: payload.rumboGrados ?? null,
            compartiendo: true,
            capturadaEn: new Date(payload.capturadaEn),
            recibidaEn: now
          }
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );

      const dto = toLocationDto(location, now);
      emitIfAvailable('ubicacion:actualizada', dto);
      recordLocationUpdate('success');
      return dto;
    } catch (error) {
      recordLocationUpdate('rejected');
      throw error;
    }
  });

const getLastLocation = async (now = new Date()) => {
  const location = await Ubicacion.findOne({ usuarioId: getConfig().trackingUserId }).lean();
  return toLocationDto(location, now);
};

const stopLocation = async (now = new Date()) =>
  withSpan('sion.location.stop', null, async () => {
    const location = await Ubicacion.findOneAndUpdate(
      { usuarioId: getConfig().trackingUserId },
      { $set: { compartiendo: false, recibidaEn: now } },
      { new: true, runValidators: true }
    );
    if (!location) throw ApiError.notFound('No existe una ubicación registrada', 'LOCATION_NOT_FOUND');

    const dto = toLocationDto(location, now);
    const eventPayload = {
      usuarioId: dto.usuarioId,
      estado: 'INACTIVA',
      fecha: now
    };
    emitIfAvailable('ubicacion:detenida', eventPayload);
    return eventPayload;
  });

module.exports = {
  getLocationState,
  toLocationDto,
  emitIfAvailable,
  updateLocation,
  getLastLocation,
  stopLocation
};

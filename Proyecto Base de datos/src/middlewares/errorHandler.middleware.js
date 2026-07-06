const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { getTraceContext } = require('../observability/tracing');
const { recordApiError } = require('../observability/metrics');

const normalizeError = (error) => {
  if (error instanceof ApiError) return error;

  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      path: item.path,
      message: item.message
    }));
    return ApiError.badRequest('Los datos no cumplen el esquema', 'VALIDATION_ERROR', details);
  }

  if (error?.name === 'CastError') {
    return ApiError.badRequest('Identificador inválido', 'INVALID_OBJECT_ID');
  }

  if (error?.code === 11000) {
    return ApiError.conflict('El recurso ya existe', 'DUPLICATE_RESOURCE');
  }

  return new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error interno');
};

const errorHandler = (error, _req, res, _next) => {
  const normalized = normalizeError(error);
  const { trace_id: traceId } = getTraceContext();
  const statusFamily = `${Math.floor(normalized.statusCode / 100)}xx`;
  recordApiError(normalized.code, statusFamily);

  const payload = {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details || []
    }
  };

  if (traceId) payload.error.traceId = traceId;
  if (process.env.NODE_ENV !== 'production' && normalized.statusCode === 500) {
    payload.error.debug = error.message;
  }

  res.status(normalized.statusCode).json(payload);
};

module.exports = { errorHandler, normalizeError };

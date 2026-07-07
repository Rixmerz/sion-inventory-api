class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, code = 'VALIDATION_ERROR', details = []) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'API Key ausente o incorrecta') {
    return new ApiError(401, 'INVALID_API_KEY', message);
  }

  static notFound(message, code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static unprocessable(message, code = 'BUSINESS_RULE_ERROR') {
    return new ApiError(422, code, message);
  }

  static tooManyRequests(message, code = 'RATE_LIMIT') {
    return new ApiError(429, code, message);
  }

  static serviceUnavailable(message = 'Base de datos no disponible') {
    return new ApiError(503, 'DATABASE_ERROR', message);
  }
}

module.exports = ApiError;

const mongoose = require('mongoose');
const ApiError = require('../../src/utils/ApiError');
const asyncHandler = require('../../src/utils/asyncHandler');
const { success, paginated } = require('../../src/utils/response');
const validate = require('../../src/middlewares/validate.middleware');
const validarObjectId = require('../../src/middlewares/validarObjectId.middleware');
const { safeEqual, apiKeyMiddleware } = require('../../src/middlewares/apiKey.middleware');
const notFound = require('../../src/middlewares/notFound.middleware');
const { normalizeError, errorHandler } = require('../../src/middlewares/errorHandler.middleware');
const { createGeneralRateLimiter } = require('../../src/middlewares/rateLimit.middleware');
const { z } = require('zod');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Utilidades y middlewares', () => {
  test('ApiError expone fábricas', () => {
    expect(ApiError.badRequest('x').statusCode).toBe(400);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.notFound('x').statusCode).toBe(404);
    expect(ApiError.conflict('x').statusCode).toBe(409);
    expect(ApiError.unprocessable('x').statusCode).toBe(422);
    expect(ApiError.tooManyRequests('x').statusCode).toBe(429);
    expect(ApiError.serviceUnavailable().statusCode).toBe(503);
  });

  test('response construye respuestas exitosas y paginadas', () => {
    const res = makeRes();
    success(res, { a: 1 }, 'ok', 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ ok: true, data: { a: 1 }, message: 'ok' });

    paginated(res, [1], { page: 1 });
    expect(res.json).toHaveBeenLastCalledWith({ ok: true, data: [1], meta: { page: 1 } });
  });

  test('asyncHandler propaga errores y resuelve éxito', async () => {
    const next = jest.fn();
    const ok = jest.fn().mockResolvedValue('x');
    asyncHandler(ok)({}, {}, next);
    await new Promise(setImmediate);
    expect(ok).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    const error = new Error('boom');
    asyncHandler(() => Promise.reject(error))({}, {}, next);
    await new Promise(setImmediate);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('validate guarda datos parseados y propaga detalles', () => {
    const schema = z.object({ value: z.string().min(2) });
    const next = jest.fn();
    const req = { body: { value: 'ok' } };
    validate(schema)(req, {}, next);
    expect(req.validated.body).toEqual({ value: 'ok' });
    expect(next).toHaveBeenCalledWith();

    const badNext = jest.fn();
    validate(schema)({ body: { value: '' } }, {}, badNext);
    expect(badNext.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
    expect(badNext.mock.calls[0][0].details[0].path).toBe('value');
  });

  test('validarObjectId acepta y rechaza IDs', () => {
    const next = jest.fn();
    validarObjectId('id')({ params: { id: '64f000000000000000000001' } }, {}, next);
    expect(next).toHaveBeenCalledWith();

    const badNext = jest.fn();
    validarObjectId('id')({ params: { id: 'bad' } }, {}, badNext);
    expect(badNext.mock.calls[0][0].code).toBe('INVALID_OBJECT_ID');
  });

  test('API key usa comparación segura', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('ab', 'abc')).toBe(false);
    expect(safeEqual(undefined, 'abc')).toBe(false);

    process.env.TRACKING_API_KEY = 'test-api-key';
    const next = jest.fn();
    apiKeyMiddleware({ get: () => 'test-api-key' }, {}, next);
    expect(next).toHaveBeenCalledWith();

    const bad = jest.fn();
    apiKeyMiddleware({ get: () => 'bad' }, {}, bad);
    expect(bad.mock.calls[0][0].code).toBe('INVALID_API_KEY');
  });

  test('notFound produce error uniforme', () => {
    const next = jest.fn();
    notFound({ method: 'GET', originalUrl: '/x' }, {}, next);
    expect(next.mock.calls[0][0].code).toBe('ROUTE_NOT_FOUND');
  });

  test('normalizeError reconoce ApiError, Mongoose, cast, duplicado e interno', () => {
    const api = ApiError.notFound('x');
    expect(normalizeError(api)).toBe(api);

    const validation = new mongoose.Error.ValidationError();
    validation.addError('nombre', new mongoose.Error.ValidatorError({ path: 'nombre', message: 'requerido' }));
    expect(normalizeError(validation).code).toBe('VALIDATION_ERROR');
    expect(normalizeError({ name: 'CastError' }).code).toBe('INVALID_OBJECT_ID');
    expect(normalizeError({ code: 11000 }).code).toBe('DUPLICATE_RESOURCE');
    expect(normalizeError(new Error('x')).code).toBe('INTERNAL_ERROR');
  });

  test('errorHandler responde y agrega debug solo fuera de producción', () => {
    const res = makeRes();
    process.env.NODE_ENV = 'test';
    errorHandler(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.debug).toBe('boom');

    const res2 = makeRes();
    process.env.NODE_ENV = 'production';
    errorHandler(ApiError.badRequest('mal'), {}, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json.mock.calls[0][0].error.debug).toBeUndefined();
    process.env.NODE_ENV = 'test';
  });

  test('rate limiter crea middleware con respuesta uniforme', () => {
    const limiter = createGeneralRateLimiter();
    expect(typeof limiter).toBe('function');
  });
});

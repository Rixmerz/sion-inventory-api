const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    return next(ApiError.badRequest('Los datos enviados no son válidos', 'VALIDATION_ERROR', details));
  }

  req.validated = req.validated || {};
  req.validated[source] = result.data;
  return next();
};

module.exports = validate;

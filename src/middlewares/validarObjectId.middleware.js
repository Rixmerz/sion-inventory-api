const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validarObjectId = (...paramNames) => (req, _res, next) => {
  const invalid = paramNames.find((name) => !mongoose.isObjectIdOrHexString(req.params[name]));
  if (invalid) {
    return next(ApiError.badRequest(`El parámetro ${invalid} no es un ObjectId válido`, 'INVALID_OBJECT_ID'));
  }
  return next();
};

module.exports = validarObjectId;

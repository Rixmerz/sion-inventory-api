const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'ID de MongoDB inválido');

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(10);
const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const order = z.enum(['asc', 'desc']).default('desc');

module.exports = { z, objectId, page, limit, booleanQuery, order };

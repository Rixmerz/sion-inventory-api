const { z } = require('./common');
const { varianteBaseSchema } = require('./producto.validator');

const createVarianteSchema = varianteBaseSchema;

const updateVarianteSchema = z
  .object({
    sku: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()).optional(),
    talla: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()).optional(),
    color: z.string().trim().min(2).max(50).optional(),
    stockMinimo: z.number().int().min(0).optional(),
    activo: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

module.exports = { createVarianteSchema, updateVarianteSchema };

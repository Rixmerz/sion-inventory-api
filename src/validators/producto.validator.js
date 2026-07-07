const { z, page, limit, booleanQuery, order } = require('./common');

const varianteBaseSchema = z
  .object({
    sku: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
    talla: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
    color: z.string().trim().min(2).max(50),
    stockMinimo: z.number().int().min(0).default(3),
    activo: z.boolean().optional()
  })
  .strict();

const createProductoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120),
    descripcion: z.string().trim().max(1000).optional().default(''),
    categoria: z.string().trim().min(2).max(80),
    precio: z.number().min(0),
    variantes: z.array(varianteBaseSchema).max(100).optional().default([])
  })
  .strict();

const updateProductoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(120).optional(),
    descripcion: z.string().trim().max(1000).optional(),
    categoria: z.string().trim().min(2).max(80).optional(),
    precio: z.number().min(0).optional(),
    activo: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe enviar al menos un campo');

const listProductoQuerySchema = z
  .object({
    page,
    limit,
    buscar: z.string().trim().max(120).optional(),
    categoria: z.string().trim().max(80).optional(),
    activo: booleanQuery,
    sort: z.enum(['nombre', 'precio', 'createdAt']).default('createdAt'),
    order
  })
  .strict();

module.exports = {
  createProductoSchema,
  updateProductoSchema,
  listProductoQuerySchema,
  varianteBaseSchema
};

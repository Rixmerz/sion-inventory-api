const { z, page, limit, order, objectId } = require('./common');

const common = {
  productoId: objectId,
  varianteId: objectId,
  motivo: z.string().trim().max(500).optional().default('')
};

const movimientoSchema = z.discriminatedUnion('tipo', [
  z
    .object({
      ...common,
      tipo: z.literal('ENTRADA'),
      cantidad: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      ...common,
      tipo: z.literal('SALIDA'),
      cantidad: z.number().int().positive()
    })
    .strict(),
  z
    .object({
      productoId: objectId,
      varianteId: objectId,
      tipo: z.literal('AJUSTE'),
      stockObjetivo: z.number().int().min(0),
      motivo: z.string().trim().min(1).max(500)
    })
    .strict()
]);

const listMovimientoQuerySchema = z
  .object({
    page,
    limit,
    tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']).optional(),
    productoId: objectId.optional(),
    sku: z.string().trim().max(80).transform((v) => v.toUpperCase()).optional(),
    desde: z.string().datetime({ offset: true }).optional(),
    hasta: z.string().datetime({ offset: true }).optional(),
    sort: z.literal('createdAt').default('createdAt'),
    order
  })
  .strict()
  .refine(
    (value) => !value.desde || !value.hasta || new Date(value.desde) <= new Date(value.hasta),
    'La fecha desde no puede ser posterior a la fecha hasta'
  );

const lowStockQuerySchema = z
  .object({
    page,
    limit,
    categoria: z.string().trim().max(80).optional(),
    incluirAgotados: z.enum(['true', 'false']).transform((v) => v === 'true').default('true')
  })
  .strict();

module.exports = { movimientoSchema, listMovimientoQuerySchema, lowStockQuerySchema };

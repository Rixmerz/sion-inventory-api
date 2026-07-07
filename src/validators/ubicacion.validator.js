const { z } = require('./common');

const updateUbicacionSchema = z
  .object({
    latitud: z.number().min(-90).max(90),
    longitud: z.number().min(-180).max(180),
    precisionMetros: z.number().min(0).optional(),
    velocidadMps: z.number().min(0).optional(),
    rumboGrados: z.number().min(0).max(360).optional(),
    capturadaEn: z.string().datetime({ offset: true })
  })
  .strict()
  .refine(
    (value) => new Date(value.capturadaEn).getTime() <= Date.now() + 5 * 60 * 1000,
    'La fecha de captura no puede estar excesivamente en el futuro'
  );

module.exports = { updateUbicacionSchema };

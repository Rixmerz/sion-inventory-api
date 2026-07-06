const mongoose = require('mongoose');

const ubicacionSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    posicion: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => Array.isArray(value) && value.length === 2,
          message: 'Las coordenadas deben contener longitud y latitud'
        }
      }
    },
    precisionMetros: {
      type: Number,
      min: 0,
      default: null
    },
    velocidadMps: {
      type: Number,
      min: 0,
      default: null
    },
    rumboGrados: {
      type: Number,
      min: 0,
      max: 360,
      default: null
    },
    compartiendo: {
      type: Boolean,
      default: true
    },
    capturadaEn: {
      type: Date,
      required: true
    },
    recibidaEn: {
      type: Date,
      required: true
    }
  },
  { timestamps: true, versionKey: false }
);

ubicacionSchema.index({ posicion: '2dsphere' });
ubicacionSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Ubicacion', ubicacionSchema);

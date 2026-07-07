const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema(
  {
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
      index: true
    },
    variante: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    tipo: {
      type: String,
      enum: ['ENTRADA', 'SALIDA', 'AJUSTE'],
      required: true,
      index: true
    },
    cantidad: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'La cantidad debe ser un número entero'
      }
    },
    direccionAjuste: {
      type: String,
      enum: ['AUMENTO', 'DISMINUCION', null],
      default: null
    },
    stockAnterior: {
      type: Number,
      required: true,
      min: 0
    },
    stockNuevo: {
      type: Number,
      required: true,
      min: 0
    },
    motivo: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  { timestamps: true, versionKey: false }
);

movimientoSchema.index({ producto: 1, createdAt: -1 });
movimientoSchema.index({ sku: 1, createdAt: -1 });
movimientoSchema.index({ tipo: 1, createdAt: -1 });
movimientoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Movimiento', movimientoSchema);

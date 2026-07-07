const mongoose = require('mongoose');

const varianteSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    talla: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    color: {
      type: String,
      required: true,
      trim: true
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'El stock debe ser un número entero'
      }
    },
    stockMinimo: {
      type: Number,
      min: 0,
      default: 3,
      validate: {
        validator: Number.isInteger,
        message: 'El stock mínimo debe ser un número entero'
      }
    },
    activo: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const productoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    descripcion: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    categoria: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    precio: {
      type: Number,
      required: true,
      min: 0
    },
    activo: {
      type: Boolean,
      default: true
    },
    variantes: {
      type: [varianteSchema],
      default: []
    }
  },
  { timestamps: true, versionKey: false }
);

productoSchema.index({ nombre: 'text', descripcion: 'text', categoria: 'text' });
productoSchema.index({ 'variantes.sku': 1 });
productoSchema.index({ activo: 1 });
productoSchema.index({ categoria: 1 });

module.exports = mongoose.model('Producto', productoSchema);

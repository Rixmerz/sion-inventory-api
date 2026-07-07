require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('../src/config/database');
const productService = require('../src/services/producto.service');
const inventoryService = require('../src/services/inventario.service');
const Producto = require('../src/models/Producto');

const run = async () => {
  await connectDatabase(process.env.MONGODB_URI);

  if (String(process.env.SEED_RESET).toLowerCase() === 'true') {
    const Movimiento = require('../src/models/Movimiento');
    const Ubicacion = require('../src/models/Ubicacion');
    await Promise.all([Producto.deleteMany({}), Movimiento.deleteMany({}), Ubicacion.deleteMany({})]);
    console.log('Datos anteriores eliminados');
  }

  const existing = await Producto.findOne({ nombre: 'Polerón SION Gracia' });
  if (existing) {
    console.log(`Los datos de demostración ya existen: ${existing._id}`);
    return;
  }

  const product = await productService.createProduct({
    nombre: 'Polerón SION Gracia',
    descripcion: 'Polerón oversize de algodón para demostración',
    categoria: 'Polerones',
    precio: 34990,
    variantes: [
      { sku: 'SION-POL-GRACIA-NEG-M', talla: 'M', color: 'Negro', stockMinimo: 3 },
      { sku: 'SION-POL-GRACIA-BLA-L', talla: 'L', color: 'Blanco', stockMinimo: 4 }
    ]
  });

  for (const variant of product.variantes) {
    await inventoryService.registerMovement({
      productoId: String(product._id),
      varianteId: String(variant._id),
      tipo: 'ENTRADA',
      cantidad: 10,
      motivo: 'Carga inicial de demostración'
    });
  }

  console.log(`Producto de demostración creado: ${product._id}`);
};

run()
  .catch((error) => {
    console.error('No fue posible cargar los datos:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);

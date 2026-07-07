const Producto = require('../models/Producto');
const ApiError = require('../utils/ApiError');

const comboKey = (talla, color) => `${String(talla).trim().toUpperCase()}::${String(color).trim().toLowerCase()}`;

const assertUniqueVariantsInPayload = (variantes = []) => {
  const skus = new Set();
  const combos = new Set();

  for (const variante of variantes) {
    if (skus.has(variante.sku)) {
      throw ApiError.conflict(`El SKU ${variante.sku} está repetido`, 'DUPLICATE_SKU');
    }
    skus.add(variante.sku);

    const key = comboKey(variante.talla, variante.color);
    if (combos.has(key)) {
      throw ApiError.conflict('La combinación talla y color está repetida', 'DUPLICATE_VARIANT');
    }
    combos.add(key);
  }
};

const ensureSkuAvailable = async (skuOrSkus, excludeVariantId = null) => {
  const skus = Array.isArray(skuOrSkus) ? skuOrSkus : [skuOrSkus];
  if (skus.length === 0) return;

  const elemMatch = { sku: { $in: skus } };
  if (excludeVariantId) elemMatch._id = { $ne: excludeVariantId };

  const existing = await Producto.findOne({ variantes: { $elemMatch: elemMatch } }).lean();
  if (existing) {
    throw ApiError.conflict('Uno de los SKU ya se encuentra registrado', 'DUPLICATE_SKU');
  }
};

const createProduct = async (payload) => {
  assertUniqueVariantsInPayload(payload.variantes);
  await ensureSkuAvailable(payload.variantes.map((variant) => variant.sku));
  return Producto.create({
    ...payload,
    variantes: payload.variantes.map((variant) => ({ ...variant, stock: 0 }))
  });
};

const listProducts = async (query) => {
  const { page, limit, buscar, categoria, activo, sort, order } = query;
  const filter = {};
  if (buscar) filter.$text = { $search: buscar };
  if (categoria) filter.categoria = categoria;
  if (typeof activo === 'boolean') filter.activo = activo;

  const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Producto.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
    Producto.countDocuments(filter)
  ]);

  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getProductById = async (productoId) => {
  const product = await Producto.findById(productoId).lean();
  if (!product) throw ApiError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
  return product;
};

const getProductDocument = async (productoId) => {
  const product = await Producto.findById(productoId);
  if (!product) throw ApiError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
  return product;
};

const updateProduct = async (productoId, payload) => {
  const product = await Producto.findByIdAndUpdate(productoId, payload, {
    new: true,
    runValidators: true
  });
  if (!product) throw ApiError.notFound('Producto no encontrado', 'PRODUCT_NOT_FOUND');
  return product;
};

const deactivateProduct = async (productoId) => updateProduct(productoId, { activo: false });

const addVariant = async (productoId, payload) => {
  const product = await getProductDocument(productoId);
  if (!product.activo) throw ApiError.unprocessable('El producto está inactivo', 'INACTIVE_PRODUCT');

  await ensureSkuAvailable(payload.sku);
  const duplicate = product.variantes.some(
    (variant) => comboKey(variant.talla, variant.color) === comboKey(payload.talla, payload.color)
  );
  if (duplicate) throw ApiError.conflict('La combinación talla y color ya existe', 'DUPLICATE_VARIANT');

  product.variantes.push({ ...payload, stock: 0 });
  await product.save();
  return product.variantes[product.variantes.length - 1];
};

const updateVariant = async (productoId, varianteId, payload) => {
  const product = await getProductDocument(productoId);
  const variant = product.variantes.id(varianteId);
  if (!variant) throw ApiError.notFound('Variante no encontrada', 'VARIANT_NOT_FOUND');

  const nextSku = payload.sku ?? variant.sku;
  const nextTalla = payload.talla ?? variant.talla;
  const nextColor = payload.color ?? variant.color;

  if (payload.sku && payload.sku !== variant.sku) {
    await ensureSkuAvailable(payload.sku, varianteId);
  }

  const duplicate = product.variantes.some(
    (candidate) =>
      String(candidate._id) !== String(varianteId) &&
      comboKey(candidate.talla, candidate.color) === comboKey(nextTalla, nextColor)
  );
  if (duplicate) throw ApiError.conflict('La combinación talla y color ya existe', 'DUPLICATE_VARIANT');

  Object.entries({ ...payload, sku: nextSku, talla: nextTalla, color: nextColor }).forEach(([key, value]) => {
    if (value !== undefined) variant[key] = value;
  });
  await product.save();
  return variant;
};

const deactivateVariant = async (productoId, varianteId) =>
  updateVariant(productoId, varianteId, { activo: false });

const getProductStock = async (productoId) => {
  const product = await getProductById(productoId);
  const variants = product.variantes.map((variant) => ({
    varianteId: variant._id,
    sku: variant.sku,
    talla: variant.talla,
    color: variant.color,
    stock: variant.stock,
    stockMinimo: variant.stockMinimo,
    activo: variant.activo,
    estadoStock:
      variant.stock === 0 ? 'AGOTADO' : variant.stock <= variant.stockMinimo ? 'BAJO' : 'DISPONIBLE'
  }));

  return {
    productoId: product._id,
    nombre: product.nombre,
    stockTotal: variants.reduce((total, variant) => total + variant.stock, 0),
    variantes: variants
  };
};

module.exports = {
  comboKey,
  assertUniqueVariantsInPayload,
  ensureSkuAvailable,
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deactivateProduct,
  addVariant,
  updateVariant,
  deactivateVariant,
  getProductStock
};

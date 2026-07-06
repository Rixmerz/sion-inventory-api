const productService = require('../services/producto.service');
const { success, paginated } = require('../utils/response');

const createProduct = async (req, res) => {
  const product = await productService.createProduct(req.validated.body);
  return success(res, product, 'Producto creado correctamente', 201);
};

const listProducts = async (req, res) => {
  const result = await productService.listProducts(req.validated.query);
  return paginated(res, result.items, result.meta);
};

const getProduct = async (req, res) => {
  const product = await productService.getProductById(req.params.productoId);
  return success(res, product, 'Producto obtenido correctamente');
};

const updateProduct = async (req, res) => {
  const product = await productService.updateProduct(req.params.productoId, req.validated.body);
  return success(res, product, 'Producto actualizado correctamente');
};

const deleteProduct = async (req, res) => {
  const product = await productService.deactivateProduct(req.params.productoId);
  return success(res, product, 'Producto desactivado correctamente');
};

const getProductStock = async (req, res) => {
  const stock = await productService.getProductStock(req.params.productoId);
  return success(res, stock, 'Stock del producto obtenido correctamente');
};

module.exports = {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductStock
};

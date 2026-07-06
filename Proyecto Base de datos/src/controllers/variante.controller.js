const productService = require('../services/producto.service');
const { success } = require('../utils/response');

const createVariant = async (req, res) => {
  const variant = await productService.addVariant(req.params.productoId, req.validated.body);
  return success(res, variant, 'Variante creada correctamente', 201);
};

const updateVariant = async (req, res) => {
  const variant = await productService.updateVariant(
    req.params.productoId,
    req.params.varianteId,
    req.validated.body
  );
  return success(res, variant, 'Variante actualizada correctamente');
};

const deleteVariant = async (req, res) => {
  const variant = await productService.deactivateVariant(req.params.productoId, req.params.varianteId);
  return success(res, variant, 'Variante desactivada correctamente');
};

module.exports = { createVariant, updateVariant, deleteVariant };

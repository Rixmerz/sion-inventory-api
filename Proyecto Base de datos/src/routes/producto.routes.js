const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const validarObjectId = require('../middlewares/validarObjectId.middleware');
const productController = require('../controllers/producto.controller');
const variantController = require('../controllers/variante.controller');
const {
  createProductoSchema,
  updateProductoSchema,
  listProductoQuerySchema
} = require('../validators/producto.validator');
const { createVarianteSchema, updateVarianteSchema } = require('../validators/variante.validator');

const router = express.Router();

router
  .route('/')
  .post(validate(createProductoSchema), asyncHandler(productController.createProduct))
  .get(validate(listProductoQuerySchema, 'query'), asyncHandler(productController.listProducts));

router.get(
  '/:productoId/stock',
  validarObjectId('productoId'),
  asyncHandler(productController.getProductStock)
);

router.post(
  '/:productoId/variantes',
  validarObjectId('productoId'),
  validate(createVarianteSchema),
  asyncHandler(variantController.createVariant)
);

router
  .route('/:productoId/variantes/:varianteId')
  .patch(
    validarObjectId('productoId', 'varianteId'),
    validate(updateVarianteSchema),
    asyncHandler(variantController.updateVariant)
  )
  .delete(
    validarObjectId('productoId', 'varianteId'),
    asyncHandler(variantController.deleteVariant)
  );

router
  .route('/:productoId')
  .get(validarObjectId('productoId'), asyncHandler(productController.getProduct))
  .patch(
    validarObjectId('productoId'),
    validate(updateProductoSchema),
    asyncHandler(productController.updateProduct)
  )
  .delete(validarObjectId('productoId'), asyncHandler(productController.deleteProduct));

module.exports = router;

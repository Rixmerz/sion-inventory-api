const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { apiKeyMiddleware } = require('../middlewares/apiKey.middleware');
const locationController = require('../controllers/ubicacion.controller');
const { updateUbicacionSchema } = require('../validators/ubicacion.validator');

const router = express.Router();
router.use(apiKeyMiddleware);

router
  .route('/')
  .patch(validate(updateUbicacionSchema), asyncHandler(locationController.updateLocation))
  .get(asyncHandler(locationController.getLocation));
router.post('/detener', asyncHandler(locationController.stopLocation));

module.exports = router;

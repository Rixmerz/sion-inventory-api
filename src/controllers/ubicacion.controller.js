const locationService = require('../services/ubicacion.service');
const { success } = require('../utils/response');

const updateLocation = async (req, res) => {
  const location = await locationService.updateLocation(req.validated.body);
  return success(res, location, 'Ubicación actualizada');
};

const getLocation = async (_req, res) => {
  const location = await locationService.getLastLocation();
  return success(res, location, 'Ubicación obtenida correctamente');
};

const stopLocation = async (_req, res) => {
  const location = await locationService.stopLocation();
  return success(res, location, 'Compartición de ubicación detenida');
};

module.exports = { updateLocation, getLocation, stopLocation };

const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('sion-inventory-api');
const movementsTotal = meter.createCounter('sion_inventory_movements_total');
const movementFailures = meter.createCounter('sion_inventory_movement_failures_total');
const locationUpdates = meter.createCounter('sion_location_updates_total');
const apiErrors = meter.createCounter('sion_api_errors_total');

let lowStockValue = 0;
let lastLocationAge = 0;

const lowStockGauge = meter.createObservableGauge('sion_inventory_low_stock_variants');
lowStockGauge.addCallback((result) => result.observe(lowStockValue));

const locationAgeGauge = meter.createObservableGauge('sion_location_last_update_age_seconds');
locationAgeGauge.addCallback((result) => result.observe(lastLocationAge));

const recordMovement = (type, result = 'success') => {
  movementsTotal.add(1, { type, result });
};

const recordMovementFailure = (type = 'UNKNOWN', reason = 'business_rule') => {
  movementFailures.add(1, { type, reason });
};

const recordLocationUpdate = (result = 'success') => {
  locationUpdates.add(1, { result });
};

const recordApiError = (code = 'INTERNAL_ERROR', statusFamily = '5xx') => {
  apiErrors.add(1, { code, status_family: statusFamily });
};

const setLowStockValue = (value) => {
  lowStockValue = Number.isFinite(value) ? value : 0;
};

const setLastLocationAge = (value) => {
  lastLocationAge = Number.isFinite(value) && value >= 0 ? value : 0;
};

module.exports = {
  recordMovement,
  recordMovementFailure,
  recordLocationUpdate,
  recordApiError,
  setLowStockValue,
  setLastLocationAge
};

require('dotenv').config();

const { getConfig } = require('../config/env');

let sdk = null;

const startTelemetry = async () => {
  const config = getConfig();
  if (!config.otelEnabled) return null;

  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { resourceFromAttributes } = require('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
    const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
    const traceExporter = new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` });
    const metricExporter = new OTLPMetricExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/metrics` });
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 60000
    });

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'sion-inventory-api',
        [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.1.0'
      }),
      traceExporter,
      metricReaders: [metricReader],
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }
        })
      ]
    });

    await sdk.start();
    return sdk;
  } catch (error) {
    console.warn('OpenTelemetry no pudo iniciarse; la API continuará sin exportación:', error.message);
    sdk = null;
    return null;
  }
};

const shutdownTelemetry = async () => {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
};

module.exports = { startTelemetry, shutdownTelemetry };

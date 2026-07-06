const { trace, SpanStatusCode } = require('@opentelemetry/api');

const tracer = trace.getTracer('sion-inventory-api');

const withSpan = async (name, attributes, operation) =>
  tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) span.setAttributes(attributes);
      const result = await operation(span);
      span.setAttribute('sion.operation.result', 'success');
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setAttribute('sion.operation.result', 'failure');
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });

const getTraceContext = () => {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const context = span.spanContext();
  return {
    trace_id: context.traceId,
    span_id: context.spanId
  };
};

module.exports = { withSpan, getTraceContext };

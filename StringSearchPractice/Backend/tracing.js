// =============================================================================
// OPENTELEMETRY — Inicialização da Observabilidade
// =============================================================================
// Este arquivo DEVE ser carregado antes de qualquer outro módulo da aplicação.
// Uso: node --import ./tracing.js server.js
//
// Exporta:
//   Traces  → Jaeger via OTLP HTTP
//   Métricas → Prometheus (porta 9464, endpoint /metrics)
//   Logs    → Console estruturado
// =============================================================================

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';

const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces';

const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9464', 10);

const sdk = new NodeSDK({
  resource: new Resource({
    'service.name': 'stringscope',
    'service.version': '2.0.0',
    'service.environment': process.env.NODE_ENV || 'development',
  }),

  traceExporter: new OTLPTraceExporter({
    url: OTLP_ENDPOINT,
  }),

  metricReader: new PrometheusExporter({
    port: PROMETHEUS_PORT,
    startServer: true,
  }),

  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();

console.log(`[otel] SDK iniciado | traces → ${OTLP_ENDPOINT} | metrics → :${PROMETHEUS_PORT}/metrics`);

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});

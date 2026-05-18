// =============================================================================
// ROTAS DE BUSCA — /api/search e /api/search/all
// =============================================================================
// Cada requisição gera:
//   • Um Trace com spans filhos por algoritmo
//   • Métricas Prometheus (duração, comparações, ocorrências, requisições)
//   • Logs estruturados no console
// =============================================================================

import { Router } from 'express';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';
import { getStrategy, ALL_STRATEGY_KEYS, STRATEGIES } from '../Strategy/searchStrategies.js';

export const searchRouter = Router();

// ── Instrumentos de métricas ──────────────────────────────────────────────────

const meter = metrics.getMeter('stringscope', '1.0.0');

const requestCounter = meter.createCounter('search_requests', {
  description: 'Total de requisições de busca por algoritmo',
});

const durationHistogram = meter.createHistogram('search_duration_ms', {
  description: 'Duração da execução de busca em milissegundos',
  advice: { explicitBucketBoundaries: [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000] },
});

const comparisonsHistogram = meter.createHistogram('search_comparisons', {
  description: 'Número de comparações realizadas por execução',
  advice: { explicitBucketBoundaries: [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000] },
});

const occurrencesCounter = meter.createCounter('search_occurrences', {
  description: 'Total de ocorrências encontradas por algoritmo',
});

const textLengthHistogram = meter.createHistogram('search_text_length', {
  description: 'Comprimento do texto de entrada em caracteres',
  advice: { explicitBucketBoundaries: [100, 500, 1000, 5000, 10000, 50000, 100000] },
});

// ── SearchResult — estrutura padronizada de retorno ───────────────────────────

function buildSearchResult({ algorithm, steps, duration, traceId }) {
  const positions = steps.filter(s => s.type === 'found').map(s => s.foundPos);
  const lastStep = steps[steps.length - 1];
  const comparisons = lastStep?.comparisons ?? 0;

  return {
    algorithm,
    steps,
    comparisons,
    positions,
    occurrences: positions.length,
    duration,
    stepCount: steps.length,
    traceId,
    timestamp: new Date().toISOString(),
  };
}

// ── POST /api/search — executa um algoritmo ───────────────────────────────────

searchRouter.post('/', async (req, res) => {
  const { text, pattern, algorithm } = req.body;

  if (!text || !pattern || !algorithm) {
    return res.status(400).json({ error: 'Campos obrigatórios: text, pattern, algorithm' });
  }

  if (algorithm === 'all') {
    return res.status(400).json({ error: 'Use /api/search/all para executar todos os algoritmos' });
  }

  const tracer = trace.getTracer('stringscope', '1.0.0');
  const attrs = { algorithm, 'text.length': text.length, 'pattern.length': pattern.length };

  return tracer.startActiveSpan(`search:${algorithm}`, { attributes: attrs }, async (span) => {
    const traceId = span.spanContext().traceId;

    try {
      const strategy = getStrategy(algorithm);

      const t0 = performance.now();
      const steps = strategy.execute(text, pattern);
      const duration = performance.now() - t0;

      const result = buildSearchResult({ algorithm, steps, duration, traceId });

      // ── Spans com detalhes de execução ────────────────────────────────────
      span.setAttributes({
        comparisons: result.comparisons,
        occurrences: result.occurrences,
        'duration.ms': parseFloat(duration.toFixed(3)),
        'steps.count': steps.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      // ── Métricas ──────────────────────────────────────────────────────────
      const labels = { algorithm };
      requestCounter.add(1, labels);
      durationHistogram.record(duration, labels);
      comparisonsHistogram.record(result.comparisons, labels);
      occurrencesCounter.add(result.occurrences, labels);
      textLengthHistogram.record(text.length, labels);

      // ── Log estruturado ───────────────────────────────────────────────────
      console.log(JSON.stringify({
        event: 'search.completed',
        algorithm,
        comparisons: result.comparisons,
        occurrences: result.occurrences,
        duration_ms: parseFloat(duration.toFixed(3)),
        text_length: text.length,
        pattern_length: pattern.length,
        trace_id: traceId,
      }));

      span.end();
      return res.json(result);

    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.end();

      console.error(JSON.stringify({ event: 'search.error', algorithm, error: err.message, trace_id: traceId }));
      return res.status(500).json({ error: err.message });
    }
  });
});

// ── POST /api/search/all — executa todos os algoritmos ───────────────────────

searchRouter.post('/all', async (req, res) => {
  const { text, pattern } = req.body;

  if (!text || !pattern) {
    return res.status(400).json({ error: 'Campos obrigatórios: text, pattern' });
  }

  const tracer = trace.getTracer('stringscope', '1.0.0');
  const attrs = { 'text.length': text.length, 'pattern.length': pattern.length, algorithms: 'all' };

  return tracer.startActiveSpan('search:all', { attributes: attrs }, async (parentSpan) => {
    const traceId = parentSpan.spanContext().traceId;
    const results = {};

    for (const key of ALL_STRATEGY_KEYS) {
      await tracer.startActiveSpan(`search:${key}`, async (span) => {
        try {
          const strategy = getStrategy(key);

          const t0 = performance.now();
          const steps = strategy.execute(text, pattern);
          const duration = performance.now() - t0;

          const positions = steps.filter(s => s.type === 'found').map(s => s.foundPos);
          const lastStep = steps[steps.length - 1];
          const comparisons = lastStep?.comparisons ?? 0;

          span.setAttributes({ comparisons, occurrences: positions.length, 'duration.ms': parseFloat(duration.toFixed(3)) });
          span.setStatus({ code: SpanStatusCode.OK });

          const labels = { algorithm: key };
          requestCounter.add(1, labels);
          durationHistogram.record(duration, labels);
          comparisonsHistogram.record(comparisons, labels);
          occurrencesCounter.add(positions.length, labels);
          textLengthHistogram.record(text.length, labels);

          results[key] = {
            comparisons,
            time: duration,
            found: positions.length,
            name: strategy.name,
            traceId,
          };

          console.log(JSON.stringify({
            event: 'search.completed',
            algorithm: key,
            comparisons,
            occurrences: positions.length,
            duration_ms: parseFloat(duration.toFixed(3)),
            text_length: text.length,
            trace_id: traceId,
          }));

        } catch (err) {
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          console.error(JSON.stringify({ event: 'search.error', algorithm: key, error: err.message }));
        } finally {
          span.end();
        }
      });
    }

    parentSpan.setAttributes({ 'algorithms.count': ALL_STRATEGY_KEYS.length });
    parentSpan.setStatus({ code: SpanStatusCode.OK });
    parentSpan.end();

    return res.json({ results, traceId });
  });
});

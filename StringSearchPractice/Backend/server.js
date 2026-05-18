// =============================================================================
// SERVIDOR EXPRESS — StringScope
// =============================================================================
// IMPORTANTE: Este arquivo deve ser iniciado com:
//   node --import ./tracing.js server.js
// O tracing.js inicializa o OpenTelemetry ANTES de qualquer import de módulo.
// =============================================================================

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { searchRouter } from './routes/search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middlewares ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Static files ──────────────────────────────────────────────────────────────
// Serve Frontend/ na raiz e Backend/ em /Backend/
// Evita expor node_modules e arquivos de servidor

const projectRoot = join(__dirname, '..');

app.use((req, res, next) => {
  if (req.path.includes('node_modules') || req.path.includes('routes')) {
    return res.status(404).end();
  }
  next();
});

app.use('/Backend', express.static(__dirname, { index: false }));
app.use(express.static(join(projectRoot, 'Frontend'), { index: false }));

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/api/search', searchRouter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'stringscope', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ── Frontend fallback ─────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(join(projectRoot, 'Frontend', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: 'server.started',
    port: PORT,
    urls: {
      app: `http://localhost:${PORT}`,
      health: `http://localhost:${PORT}/health`,
      grafana: 'http://localhost:3001',
      jaeger: 'http://localhost:16686',
      prometheus: 'http://localhost:9090',
      metrics: 'http://localhost:9464/metrics',
    },
  }));
});

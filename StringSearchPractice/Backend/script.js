// =============================================================================
// SCRIPT PRINCIPAL — Controlador da Aplicação
// =============================================================================
// Importa as estratégias pelo padrão Strategy. Para adicionar um algoritmo,
// edite apenas searchStrategies.js — este arquivo não precisa ser alterado.
// =============================================================================

import { getStrategy, ALL_STRATEGY_KEYS, STRATEGIES } from './Strategy/searchStrategies.js';

// ── Estado global ─────────────────────────────────────────────────────────────

let appText      = '';
let appPattern   = '';
let currentAlgo  = 'naive';
let steps        = [];
let currentStep  = -1;
let autoTimer    = null;
let isAutoRunning = false;
let comparisons  = 0;
let foundPositions = [];
let allResults   = {};
let isLoadingFile = false;


// ── Utilitários de UI ─────────────────────────────────────────────────────────

/** @param {string} msg @param {'idle'|'running'|'done'|'error'} type */
function setStatus(msg, type = 'idle') {
  document.getElementById('status-msg').textContent = msg;
  document.getElementById('status-dot').className = `status-dot ${type}`;
}

function updateMetrics() {
  document.getElementById('m-comparisons').textContent = comparisons;
  document.getElementById('m-found').textContent = foundPositions.length;
  document.getElementById('m-step').textContent = currentStep >= 0 ? currentStep : '—';
}

/** @param {number} step @param {string} type @param {string} msg */
function log(step, type, msg) {
  const container = document.getElementById('log-container');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-step">${String(step).padStart(3, '0')}</span>
    <span class="log-type ${type}">${type.toUpperCase()}</span>
    <span class="log-msg">${msg}</span>
  `;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

function clearLog() {
  document.getElementById('log-container').innerHTML = '';
}

/** @param {string} tabId */
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}

/** Ativa a linha correspondente ao algoritmo na tabela de complexidades. */
function updateComplexityHighlight(algo) {
  document.querySelectorAll('#complexity-tbody tr').forEach(tr => {
    tr.classList.remove('active-row');
    if (algo === 'all' || tr.dataset.algo === algo) tr.classList.add('active-row');
  });
}

/** Navega para uma aba por índice (0-based). */
function activateTabByIndex(index) {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach((t, i) => t.classList.toggle('active', i === index));
  contents.forEach((c, i) => c.classList.toggle('active', i === index));
}


// ── Renderização ──────────────────────────────────────────────────────────────

/** Renderiza o texto caractere a caractere com spans individuais. */
function renderText(text, highlights = {}) {
  const container = document.getElementById('text-display');
  container.innerHTML = '';

  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'char-span';
    span.id = `tc-${i}`;
    span.textContent = text[i] === ' ' ? '·' : text[i];
    if (highlights[i]) span.classList.add(highlights[i]);
    container.appendChild(span);
  }
}

/** Reaplica highlights sem re-renderizar o texto completo. */
function highlightTextChars(map) {
  document.querySelectorAll('.char-span').forEach(s => { s.className = 'char-span'; });
  for (const [idx, cls] of Object.entries(map)) {
    const el = document.getElementById(`tc-${idx}`);
    if (el) el.classList.add(cls);
  }
}

/**
 * Renderiza o padrão com indicação visual do estado atual da comparação.
 * @param {string} pattern
 * @param {number} activeIdx    índice sendo comparado agora
 * @param {number} matchedUntil até onde houve match (inclusive)
 * @param {number} mismatch     índice do char com mismatch (-1 = nenhum)
 */
function renderPattern(pattern, activeIdx = -1, matchedUntil = -1, mismatch = -1) {
  const container = document.getElementById('pattern-display');
  container.innerHTML = '';

  for (let i = 0; i < pattern.length; i++) {
    const span = document.createElement('span');
    span.className = 'pattern-char';
    span.textContent = pattern[i] === ' ' ? '·' : pattern[i];

    if (i === mismatch) span.classList.add('mismatched');
    else if (i <= matchedUntil && matchedUntil >= 0) span.classList.add('matched');
    if (i === activeIdx) span.classList.add('active');

    container.appendChild(span);
  }
}

/** Exibe as posições encontradas como badges clicáveis. */
function showResultPositions(positions) {
  const container = document.getElementById('result-positions');
  if (positions.length === 0) {
    container.innerHTML = '<span class="result-empty">Nenhuma ocorrência encontrada</span>';
    return;
  }
  container.innerHTML = positions.map(p => `<span class="pos-badge">pos ${p}</span>`).join('');
}


// ── Carregamento de arquivo ───────────────────────────────────────────────────

document.getElementById('file-input').addEventListener('change', function () {
  const files = Array.from(this.files);
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';

  if (files.length === 0) return;

  let combined = '';
  let loaded = 0;

  files.forEach(file => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span class="file-chip-icon">📄</span>
      <span>${file.name}</span>
      <span class="file-chip-size">(${(file.size / 1024).toFixed(1)}kb)</span>
    `;
    fileList.appendChild(chip);

    const reader = new FileReader();
    reader.onload = e => {
      combined += (combined ? '\n\n' : '') + e.target.result;
      loaded++;

      if (loaded === files.length) {
        appText = combined;
        isLoadingFile = true;
        document.getElementById('manual-text').value =
          combined.substring(0, 500) + (combined.length > 500 ? '...' : '');
        isLoadingFile = false;
        renderText(appText);
        setStatus(`${files.length} arquivo(s) carregado(s). ${appText.length} caracteres.`, 'idle');
        document.getElementById('m-textlen').textContent = appText.length;
      }
    };
    reader.readAsText(file);
  });
});

document.getElementById('manual-text').addEventListener('input', function () {
  if (isLoadingFile) return;
  appText = this.value;
  if (appText) {
    renderText(appText);
    document.getElementById('m-textlen').textContent = appText.length;
  }
});

document.getElementById('speed-slider').addEventListener('input', function () {
  document.getElementById('speed-label').textContent = this.value + 'ms';
});


// ── Helpers de entrada ────────────────────────────────────────────────────────

function getText() {
  const manual = document.getElementById('manual-text').value;
  if (manual && !manual.endsWith('...')) appText = manual;
  return appText;
}

function getPattern() {
  return document.getElementById('pattern-input').value;
}


// ── Execução dos algoritmos ───────────────────────────────────────────────────

/** Ponto de entrada: executa a busca completa (sem passo a passo). */
function runSearch() {
  const text = getText();
  const pattern = getPattern();

  if (!text || !pattern) {
    setStatus('⚠ Insira o texto e o padrão antes de executar.', 'error');
    return;
  }

  const algoKey = document.getElementById('algo-select').value;

  appText = text;
  appPattern = pattern;
  foundPositions = [];
  allResults = {};
  clearLog();

  document.getElementById('m-textlen').textContent = text.length;
  document.getElementById('m-patlen').textContent = pattern.length;
  document.getElementById('m-algo').textContent = algoKey.toUpperCase();

  renderText(text);
  renderPattern(pattern);
  updateComplexityHighlight(algoKey);

  if (algoKey === 'all') {
    runAllAlgorithms(text, pattern);
    return;
  }

  const strategy = getStrategy(algoKey);
  const t0 = performance.now();
  const algoSteps = strategy.execute(text, pattern);
  const t1 = performance.now();

  const lastStep = algoSteps[algoSteps.length - 1];
  const totalComparisons = lastStep ? lastStep.comparisons : 0;
  const positions = algoSteps.filter(s => s.type === 'found').map(s => s.foundPos);

  comparisons = totalComparisons;
  foundPositions = positions;

  document.getElementById('m-comparisons').textContent = totalComparisons;
  document.getElementById('m-time').textContent = (t1 - t0).toFixed(3);
  document.getElementById('m-found').textContent = positions.length;
  document.getElementById('m-step').textContent = algoSteps.length;

  showResultPositions(positions);

  const hmap = {};
  positions.forEach(p => {
    for (let k = p; k < p + pattern.length; k++) hmap[k] = 'full-match';
  });
  highlightTextChars(hmap);

  algoSteps.forEach((s, idx) => {
    log(idx + 1, stepLogType(s.type), s.msg);
  });

  renderAuxTable(algoKey, pattern);

  setStatus(
    `✓ Busca concluída: ${positions.length} ocorrência(s) | ${totalComparisons} comparações | ${(t1 - t0).toFixed(3)}ms`,
    'done'
  );

  allResults[algoKey] = { comparisons: totalComparisons, time: t1 - t0, found: positions.length };
  updateCompareTable();
  activateTabByIndex(0);
}

/** Executa todos os algoritmos e navega para a aba de comparação. */
function runAllAlgorithms(text, pattern) {
  ALL_STRATEGY_KEYS.forEach(key => {
    const strategy = getStrategy(key);
    const t0 = performance.now();
    const algoSteps = strategy.execute(text, pattern);
    const t1 = performance.now();

    const lastStep = algoSteps[algoSteps.length - 1];
    const totalComp = lastStep ? lastStep.comparisons : 0;
    const positions = algoSteps.filter(s => s.type === 'found').map(s => s.foundPos);

    allResults[key] = {
      comparisons: totalComp,
      time: t1 - t0,
      found: positions.length,
      name: strategy.name,
    };

    log(1, 'compare',
      `[${strategy.name}] ${totalComp} comparações, ${(t1 - t0).toFixed(3)}ms, ${positions.length} ocorrências`
    );
  });

  updateCompareTable();
  setStatus('✓ Todos os algoritmos executados. Compare na aba "Comparar".', 'done');
  activateTabByIndex(4);
}

/** Atualiza a tabela comparativa destacando os melhores valores. */
function updateCompareTable() {
  const container = document.getElementById('compare-content');
  if (Object.keys(allResults).length === 0) return;

  const entries = Object.entries(allResults);
  const minComp = Math.min(...entries.map(([, v]) => v.comparisons));
  const minTime = Math.min(...entries.map(([, v]) => v.time));

  let html = `
    <table class="compare-table">
      <thead><tr>
        <th>Algoritmo</th>
        <th>Comparações</th>
        <th>Tempo (ms)</th>
        <th>Ocorrências</th>
        <th>Complexidade Teórica</th>
      </tr></thead>
      <tbody>
  `;

  entries.forEach(([key, r]) => {
    const strategy = STRATEGIES[key];
    const isBestComp = r.comparisons === minComp;
    const isBestTime = r.time === minTime;
    html += `
      <tr>
        <td class="compare-name">${r.name || strategy.name}</td>
        <td class="${isBestComp ? 'best' : ''}">${r.comparisons}</td>
        <td class="${isBestTime ? 'best' : ''}">${r.time.toFixed(3)}</td>
        <td>${r.found}</td>
        <td class="compare-complexity">${strategy.complexity.worst}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

/** Mapeia o tipo do passo para a categoria de log. */
function stepLogType(type) {
  const map = { found: 'found', mismatch: 'mismatch', shift: 'shift' };
  return map[type] || 'compare';
}


// ── Tabela auxiliar (delegada à Strategy) ─────────────────────────────────────

/** Constrói e exibe a tabela auxiliar usando a estratégia ativa. */
function renderAuxTable(algoKey, pattern) {
  const strategy = getStrategy(algoKey);
  const { title, html } = strategy.buildAuxTable(pattern);

  document.getElementById('aux-title').textContent = title;
  document.getElementById('aux-table-container').innerHTML = html;
}


// ── Modo passo a passo ────────────────────────────────────────────────────────

/** Inicializa o modo passo a passo gerando todos os passos em memória. */
function initStepByStep() {
  const text = getText();
  const pattern = getPattern();

  if (!text || !pattern) {
    setStatus('⚠ Insira o texto e o padrão.', 'error');
    return;
  }

  const algoKey = document.getElementById('algo-select').value;
  if (algoKey === 'all') {
    setStatus('⚠ Selecione um algoritmo específico para o modo passo a passo.', 'error');
    return;
  }

  const strategy = getStrategy(algoKey);

  appText = text;
  appPattern = pattern;
  currentAlgo = algoKey;
  steps = strategy.execute(text, pattern);
  currentStep = -1;
  foundPositions = [];
  clearLog();

  renderText(text);
  renderPattern(pattern);
  renderAuxTable(algoKey, pattern);
  updateComplexityHighlight(algoKey);

  document.getElementById('m-textlen').textContent = text.length;
  document.getElementById('m-patlen').textContent = pattern.length;
  document.getElementById('m-algo').textContent = algoKey.toUpperCase();
  document.getElementById('m-comparisons').textContent = 0;
  document.getElementById('m-found').textContent = 0;
  document.getElementById('m-step').textContent = `0/${steps.length}`;

  document.getElementById('btn-next').disabled = false;
  document.getElementById('btn-prev').disabled = true;
  document.getElementById('btn-auto').disabled = false;
  document.getElementById('result-positions').innerHTML =
    '<span class="result-empty">—</span>';

  setStatus(`Modo passo a passo: ${steps.length} passos. Use ▶ para avançar.`, 'idle');
}

/** Aplica visualmente o passo atual (highlights, métricas, log, tabelas). */
function applyStep(step) {
  if (!step) return;

  highlightTextChars(step.textHighlights || {});
  renderPattern(
    appPattern,
    step.patternActive,
    step.matchedUntil >= 0 ? step.matchedUntil : -1,
    step.patternMismatch >= 0 ? step.patternMismatch : -1
  );

  comparisons = step.comparisons;
  updateMetrics();
  document.getElementById('m-step').textContent = `${currentStep + 1}/${steps.length}`;

  if (step.found && step.found.length > 0) {
    foundPositions = step.found;
    document.getElementById('m-found').textContent = foundPositions.length;
    showResultPositions(foundPositions);
  }

  // Highlight na tabela LPS (KMP)
  if (currentAlgo === 'kmp' && step.lps) {
    const cells = document.querySelectorAll('#aux-table td');
    cells.forEach((c, i) => {
      c.classList.remove('highlight');
      if (i === step.lpsHighlight) c.classList.add('highlight');
    });
  }

  // Highlight na tabela Bad Character (Boyer-Moore)
  if (currentAlgo === 'bm' && step.badChar && step.badCharHighlight) {
    const headers = document.querySelectorAll('#aux-table thead tr:first-child th');
    const cells = document.querySelectorAll('#aux-table tbody td');
    headers.forEach((h, i) => {
      if (cells[i]) cells[i].classList.remove('highlight');
      if (h.textContent === step.badCharHighlight && cells[i]) {
        cells[i].classList.add('highlight');
      }
    });
  }

  log(currentStep + 1, stepLogType(step.type), step.msg);
  document.getElementById('pattern-info').textContent = step.msg;

  if (step.type === 'found') {
    setStatus(`✓ Ocorrência encontrada na posição ${step.foundPos}! (${foundPositions.length} total)`, 'done');
  } else {
    setStatus(step.msg, 'running');
  }
}

function nextStep() {
  if (currentStep >= steps.length - 1) {
    setStatus('✓ Execução concluída!', 'done');
    return;
  }
  currentStep++;
  applyStep(steps[currentStep]);

  document.getElementById('btn-prev').disabled = false;

  if (currentStep >= steps.length - 1) {
    document.getElementById('btn-next').disabled = true;
    document.getElementById('btn-auto').disabled = true;
  }
}

function prevStep() {
  if (currentStep <= 0) return;
  currentStep--;
  applyStep(steps[currentStep]);

  document.getElementById('btn-next').disabled = false;
  document.getElementById('btn-auto').disabled = false;
  if (currentStep === 0) document.getElementById('btn-prev').disabled = true;
}

function toggleAuto() {
  if (isAutoRunning) return;
  isAutoRunning = true;

  document.getElementById('btn-auto').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  setStatus('▶ Execução automática em andamento...', 'running');
  runAutoStep();
}

function runAutoStep() {
  if (!isAutoRunning || currentStep >= steps.length - 1) {
    isAutoRunning = false;
    document.getElementById('btn-pause').disabled = true;
    if (currentStep >= steps.length - 1) setStatus('✓ Execução automática concluída!', 'done');
    return;
  }

  nextStep();
  const speed = parseInt(document.getElementById('speed-slider').value);
  autoTimer = setTimeout(runAutoStep, speed);
}

function pauseAuto() {
  isAutoRunning = false;
  clearTimeout(autoTimer);

  document.getElementById('btn-auto').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  setStatus('⏸ Pausado.', 'idle');
}

/** Reseta a aplicação para o estado inicial. */
function resetAll() {
  isAutoRunning = false;
  clearTimeout(autoTimer);

  steps = [];
  currentStep = -1;
  comparisons = 0;
  foundPositions = [];
  allResults = {};

  document.getElementById('text-display').innerHTML = '';
  document.getElementById('pattern-display').innerHTML = '';
  document.getElementById('result-positions').innerHTML = '<span class="result-empty">—</span>';
  document.getElementById('aux-table-container').innerHTML =
    '<div class="aux-placeholder">Execute um algoritmo para ver a estrutura auxiliar</div>';
  document.getElementById('compare-content').innerHTML =
    '<div class="aux-placeholder">Execute com "Todos" ou individualmente para comparar</div>';

  clearLog();

  ['m-comparisons', 'm-time', 'm-found', 'm-step', 'm-textlen', 'm-patlen', 'm-algo'].forEach(id => {
    document.getElementById(id).textContent = id === 'm-algo' ? '—' : '—';
  });

  ['btn-next', 'btn-prev', 'btn-auto', 'btn-pause'].forEach(id => {
    document.getElementById(id).disabled = true;
  });

  document.querySelectorAll('#complexity-tbody tr').forEach(tr => tr.classList.remove('active-row'));
  setStatus('Aguardando entrada de dados...', 'idle');
}


// ── Drag & Drop ───────────────────────────────────────────────────────────────

const uploadArea = document.querySelector('.upload-area');

uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--accent)';
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = 'var(--border)';
});

uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--border)';
  document.getElementById('file-input').files = e.dataTransfer.files;
  document.getElementById('file-input').dispatchEvent(new Event('change'));
});


// ── Inicialização ─────────────────────────────────────────────────────────────

setStatus('Aguardando entrada de dados...', 'idle');
['btn-next', 'btn-prev', 'btn-auto', 'btn-pause'].forEach(id => {
  document.getElementById(id).disabled = true;
});


// ── Exposição ao escopo global (exigida pelos onclick do HTML) ────────────────
// Módulos ES rodam em escopo isolado. Funções chamadas via onclick="..." no HTML
// precisam ser atribuídas explicitamente a window.

window.runSearch      = runSearch;
window.initStepByStep = initStepByStep;
window.nextStep       = nextStep;
window.prevStep       = prevStep;
window.toggleAuto     = toggleAuto;
window.pauseAuto      = pauseAuto;
window.resetAll       = resetAll;
window.switchTab      = switchTab;
window.clearLog       = clearLog;

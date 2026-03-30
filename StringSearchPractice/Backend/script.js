// =============================================================================
// SCRIPT PRINCIPAL — CONTROLADOR DA APLICAÇÃO
// =============================================================================
//
// Este arquivo é o núcleo da aplicação. Ele:
//   1. Importa os algoritmos de busca de seus respectivos módulos
//   2. Gerencia o estado global da aplicação
//   3. Lida com eventos de UI (botões, inputs, drag & drop)
//   4. Renderiza o texto e o padrão com destaques visuais
//   5. Executa as buscas e o modo passo a passo
//
// ATENÇÃO: Este arquivo usa ES Modules (import/export).
//   Por isso, o <script> no HTML DEVE ter type="module":
//   <script type="module" src="../Backend/script.js"></script>
//
//   Consequência: funções declaradas aqui NÃO ficam no escopo global window
//   automaticamente. Por isso, ao final do arquivo, cada função chamada
//   diretamente pelo HTML (onclick="...") é exportada explicitamente para window.
//
// =============================================================================

// ─── IMPORTAÇÕES DOS ALGORITMOS ───────────────────────────────────────────────
// Cada algoritmo está em seu próprio arquivo para organização e reutilização.
// A sintaxe "export default" em cada arquivo permite importar com qualquer nome.
import naiveSteps from './Algoritmos/naive.js';
import rabinKarpSteps from './Algoritmos/rabinKarp.js';
import kmpSteps, { computeLPS } from './Algoritmos/kmp.js';           // kmp exporta também computeLPS (para a tabela auxiliar)
import boyerMooreSteps, { buildBadChar } from './Algoritmos/boyerMoore.js'; // bm exporta também buildBadChar (para a tabela auxiliar)

// ===================== ESTADO GLOBAL =====================
// Todas as variáveis de estado ficam no escopo do módulo (não global window).
// São mutadas conforme o usuário interage com a aplicação.

let appText = '';          // Texto completo carregado (via arquivo ou input manual)
let appPattern = '';       // Padrão de busca atual
let currentAlgo = 'naive'; // Algoritmo selecionado no momento
let steps = [];            // Lista de passos gerados para o modo passo a passo
let currentStep = -1;      // Índice do passo atual (-1 = não iniciado)
let autoTimer = null;      // Referência ao setTimeout do modo automático
let isAutoRunning = false; // Flag de controle do modo automático
let comparisons = 0;       // Total de comparações da última execução
let foundPositions = [];   // Posições onde o padrão foi encontrado
let allResults = {};       // Resultados de todos os algoritmos (para comparação)


// ===================== UTILITÁRIOS DE UI =====================

/**
 * Atualiza a mensagem de status e o indicador colorido (dot).
 * @param {string} msg  - Mensagem a exibir
 * @param {string} type - Tipo do status: 'idle' | 'running' | 'done' | 'error'
 */
function setStatus(msg, type = 'idle') {
  document.getElementById('status-msg').textContent = msg;
  const dot = document.getElementById('status-dot');
  dot.className = `status-dot ${type}`;
}

/**
 * Atualiza os contadores de métricas exibidos na UI
 * (comparações, ocorrências, passo atual).
 */
function updateMetrics() {
  document.getElementById('m-comparisons').textContent = comparisons;
  document.getElementById('m-found').textContent = foundPositions.length;
  document.getElementById('m-step').textContent = currentStep >= 0 ? currentStep : '—';
}

/**
 * Adiciona uma entrada no painel de log.
 * @param {number} step - Número do passo
 * @param {string} type - Tipo de evento ('compare' | 'found' | 'mismatch' | 'shift')
 * @param {string} msg  - Mensagem descritiva do passo
 */
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
  container.scrollTop = container.scrollHeight; // Auto-scroll para o último log
}

/** Limpa todo o painel de log. */
function clearLog() {
  document.getElementById('log-container').innerHTML = '';
}

/**
 * Troca a aba ativa no painel de visualização.
 * @param {string} id - ID do elemento da aba a ativar
 */
function switchTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}

/**
 * Destaca a linha do algoritmo ativo na tabela de complexidades.
 * @param {string} algo - Chave do algoritmo ('naive'|'rabin'|'kmp'|'bm'|'all')
 */
function updateComplexityHighlight(algo) {
  document.querySelectorAll('#complexity-tbody tr').forEach(tr => {
    tr.classList.remove('active-row');
    if (algo === 'all' || tr.dataset.algo === algo) {
      tr.classList.add('active-row');
    }
  });
}


// ===================== RENDERIZAÇÃO DO TEXTO E PADRÃO =====================

/**
 * Renderiza o texto caractere a caractere, criando um <span> por char.
 * Espaços são representados como '·' para visibilidade.
 * @param {string} text       - Texto a renderizar
 * @param {Object} highlights - Mapa { índice → className } para destacar chars
 */
function renderText(text, highlights = {}) {
  const container = document.getElementById('text-display');
  container.innerHTML = '';

  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.className = 'char-span';
    span.id = `tc-${i}`;                                  // ID único para acesso rápido
    span.textContent = text[i] === ' ' ? '·' : text[i];  // Espaço → ponto médio
    if (highlights[i]) span.classList.add(highlights[i]);
    container.appendChild(span);
  }
}

/**
 * Reaplica classes de highlight nos spans do texto já renderizado.
 * Mais eficiente que re-renderizar o texto inteiro a cada passo.
 * @param {Object} map - Mapa { índice → className }
 */
function highlightTextChars(map) {
  // Remove todos os highlights existentes
  document.querySelectorAll('.char-span').forEach(s => {
    s.className = 'char-span';
  });
  // Aplica os novos highlights
  for (const [idx, cls] of Object.entries(map)) {
    const el = document.getElementById(`tc-${idx}`);
    if (el) el.classList.add(cls);
  }
}

/**
 * Renderiza o padrão com destaques visuais indicando o estado da comparação.
 * @param {string} pattern      - O padrão a renderizar
 * @param {number} activeIdx    - Índice do char sendo comparado agora
 * @param {number} matchedUntil - Até qual índice houve match (inclusive)
 * @param {number} mismatch     - Índice do char que causou mismatch (-1 se nenhum)
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

/**
 * Exibe as posições onde o padrão foi encontrado no texto.
 * @param {number[]} positions - Array com os índices de início de cada ocorrência
 */
function showResultPositions(positions) {
  const container = document.getElementById('result-positions');

  if (positions.length === 0) {
    container.innerHTML = '<span style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--red)">Nenhuma ocorrência encontrada</span>';
    return;
  }

  // Renderiza cada posição como um "badge" clicável
  container.innerHTML = positions.map(p =>
    `<span class="pos-badge">pos ${p}</span>`
  ).join('');
}


// ===================== CARREGAMENTO DE ARQUIVO =====================

/**
 * Listener para o input de arquivo.
 * Lê um ou mais arquivos de texto e concatena seu conteúdo em appText.
 */
document.getElementById('file-input').addEventListener('change', function () {
  const files = Array.from(this.files);
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';

  if (files.length === 0) return;

  let combined = '';
  let loaded = 0;

  files.forEach(file => {
    // Cria um chip visual para cada arquivo carregado
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span class="file-chip-icon">📄</span>
      <span>${file.name}</span>
      <span style="color:var(--text3)">(${(file.size / 1024).toFixed(1)}kb)</span>
    `;
    fileList.appendChild(chip);

    // Lê o conteúdo do arquivo de forma assíncrona
    const reader = new FileReader();
    reader.onload = e => {
      combined += (combined ? '\n\n' : '') + e.target.result;
      loaded++;

      // Só atualiza o estado quando TODOS os arquivos forem lidos
      if (loaded === files.length) {
        appText = combined;
        // Mostra preview limitado a 500 chars no textarea
        document.getElementById('manual-text').value =
          combined.substring(0, 500) + (combined.length > 500 ? '...' : '');
        renderText(appText);
        setStatus(`${files.length} arquivo(s) carregado(s). ${appText.length} caracteres.`, 'idle');
        document.getElementById('m-textlen').textContent = appText.length;
      }
    };
    reader.readAsText(file);
  });
});

/**
 * Listener para o textarea de entrada manual.
 * Atualiza appText e re-renderiza o texto a cada keystroke.
 */
document.getElementById('manual-text').addEventListener('input', function () {
  appText = this.value;
  if (appText) {
    renderText(appText);
    document.getElementById('m-textlen').textContent = appText.length;
  }
});

/**
 * Listener para o slider de velocidade do modo automático.
 * Atualiza o label exibido ao lado do slider.
 */
document.getElementById('speed-slider').addEventListener('input', function () {
  document.getElementById('speed-label').textContent = this.value + 'ms';
});


// ===================== EXECUÇÃO DOS ALGORITMOS =====================

/**
 * Retorna o texto atual (prioriza o textarea manual sobre o arquivo carregado).
 * @returns {string}
 */
function getText() {
  const manual = document.getElementById('manual-text').value;
  if (manual) appText = manual;
  return appText;
}

/**
 * Retorna o padrão digitado no campo de busca.
 * @returns {string}
 */
function getPattern() {
  return document.getElementById('pattern-input').value;
}

/**
 * Ponto de entrada principal: executa a busca completa (modo não passo a passo).
 * Coleta texto e padrão, chama o algoritmo selecionado, exibe resultados.
 */
function runSearch() {
  const text = getText();
  const pattern = getPattern();

  if (!text || !pattern) {
    setStatus('⚠ Insira o texto e o padrão antes de executar.', 'error');
    return;
  }

  const algo = document.getElementById('algo-select').value;

  // Reinicia o estado
  appText = text;
  appPattern = pattern;
  foundPositions = [];
  allResults = {};
  clearLog();

  // Atualiza métricas de entrada
  document.getElementById('m-textlen').textContent = text.length;
  document.getElementById('m-patlen').textContent = pattern.length;
  document.getElementById('m-algo').textContent = algo.toUpperCase();

  renderText(text);
  renderPattern(pattern);
  updateComplexityHighlight(algo);

  // Modo "Todos": executa todos os algoritmos e vai para a aba de comparação
  if (algo === 'all') {
    runAllAlgorithms(text, pattern);
    return;
  }

  // ─── EXECUÇÃO DO ALGORITMO SELECIONADO ────────────────────────────────────
  const t0 = performance.now();
  const algoSteps = generateSteps(algo, text, pattern);
  const t1 = performance.now();

  // Extrai estatísticas do último passo (que acumula totais)
  const lastStep = algoSteps[algoSteps.length - 1];
  const totalComparisons = lastStep ? lastStep.comparisons : 0;
  const positions = algoSteps.filter(s => s.type === 'found').map(s => s.foundPos);

  comparisons = totalComparisons;
  foundPositions = positions;

  // Atualiza métricas de resultado
  document.getElementById('m-comparisons').textContent = totalComparisons;
  document.getElementById('m-time').textContent = (t1 - t0).toFixed(3);
  document.getElementById('m-found').textContent = positions.length;
  document.getElementById('m-step').textContent = algoSteps.length;

  showResultPositions(positions);

  // Destaca todas as ocorrências encontradas no texto
  const hmap = {};
  positions.forEach(p => {
    for (let k = p; k < p + pattern.length; k++) hmap[k] = 'full-match';
  });
  highlightTextChars(hmap);

  // Popula o log com todos os passos
  algoSteps.forEach((s, idx) => {
    const logType = s.type === 'found'     ? 'found'
                  : s.type === 'mismatch'  ? 'mismatch'
                  : s.type === 'shift'     ? 'shift'
                  : 'compare';
    log(idx + 1, logType, s.msg);
  });

  buildAuxTable(algo, pattern, algoSteps[0]);

  setStatus(
    `✓ Busca concluída: ${positions.length} ocorrência(s) | ${totalComparisons} comparações | ${(t1 - t0).toFixed(3)}ms`,
    'done'
  );

  allResults[algo] = { comparisons: totalComparisons, time: t1 - t0, found: positions.length };
  updateCompareTable();

  // Volta para a aba "Texto" para mostrar os resultados
  document.querySelectorAll('.tab').forEach((t, i) => { t.classList.remove('active'); if (i === 0) t.classList.add('active'); });
  document.querySelectorAll('.tab-content').forEach((t, i) => { t.classList.remove('active'); if (i === 0) t.classList.add('active'); });
}

/**
 * Despacha a geração de passos para o algoritmo correto.
 * Centraliza a lógica de seleção para evitar duplicação.
 *
 * @param {string} algo    - Chave do algoritmo
 * @param {string} text    - Texto de busca
 * @param {string} pattern - Padrão a buscar
 * @returns {Array}        - Lista de passos do algoritmo
 */
function generateSteps(algo, text, pattern) {
  switch (algo) {
    case 'naive': return naiveSteps(text, pattern);
    case 'rabin': return rabinKarpSteps(text, pattern);
    case 'kmp':   return kmpSteps(text, pattern);
    case 'bm':    return boyerMooreSteps(text, pattern);
    default:      return naiveSteps(text, pattern);
  }
}

/**
 * Executa todos os algoritmos em sequência e popula a tabela comparativa.
 * @param {string} text    - Texto de busca
 * @param {string} pattern - Padrão a buscar
 */
function runAllAlgorithms(text, pattern) {
  const algos = ['naive', 'rabin', 'kmp', 'bm'];
  const names = { naive: 'Naive', rabin: 'Rabin-Karp', kmp: 'KMP', bm: 'Boyer-Moore' };

  algos.forEach(algo => {
    const t0 = performance.now();
    const algoSteps = generateSteps(algo, text, pattern);
    const t1 = performance.now();

    const lastStep = algoSteps[algoSteps.length - 1];
    const totalComp = lastStep ? lastStep.comparisons : 0;
    const positions = algoSteps.filter(s => s.type === 'found').map(s => s.foundPos);

    allResults[algo] = {
      comparisons: totalComp,
      time: t1 - t0,
      found: positions.length,
      name: names[algo]
    };

    log(1, 'compare',
      `[${names[algo]}] ${totalComp} comparações, ${(t1 - t0).toFixed(3)}ms, ${positions.length} ocorrências`
    );
  });

  updateCompareTable();
  setStatus('✓ Todos os algoritmos executados. Compare na aba "Comparar".', 'done');

  // Navega para a aba "Comparar"
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.remove('active');
    if (i === 4) t.classList.add('active');
  });
  document.querySelectorAll('.tab-content').forEach((t, i) => {
    t.classList.remove('active');
    if (i === 4) t.classList.add('active');
  });
}

/**
 * Atualiza a tabela comparativa com os resultados de todos os algoritmos
 * executados até agora. Destaca os melhores valores (menor comparações/tempo).
 */
function updateCompareTable() {
  const container = document.getElementById('compare-content');
  if (Object.keys(allResults).length === 0) return;

  const names = { naive: 'Naive', rabin: 'Rabin-Karp', kmp: 'KMP', bm: 'Boyer-Moore' };
  const complexities = {
    naive: 'O(n·m)',
    rabin: 'O(n+m)',
    kmp:   'O(n+m)',
    bm:    'O(n/m)'
  };

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

  entries.forEach(([algo, r]) => {
    const isBestComp = r.comparisons === minComp;
    const isBestTime = r.time === minTime;
    html += `
      <tr>
        <td style="text-align:left;color:var(--text)">${names[algo] || algo}</td>
        <td class="${isBestComp ? 'best' : ''}">${r.comparisons}</td>
        <td class="${isBestTime ? 'best' : ''}">${r.time.toFixed(3)}</td>
        <td>${r.found}</td>
        <td style="color:var(--accent3)">${complexities[algo] || '—'}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}


// ===================== TABELAS AUXILIARES =====================

/**
 * Constrói e exibe a tabela auxiliar específica de cada algoritmo:
 *   - KMP       → tabela LPS
 *   - BM        → tabela Bad Character
 *   - Rabin-Karp → hash do padrão
 *   - Naive     → mensagem informando que não há estrutura auxiliar
 *
 * @param {string} algo      - Algoritmo ativo
 * @param {string} pattern   - Padrão atual
 * @param {Object} firstStep - Primeiro passo (contém dados pré-calculados)
 */
function buildAuxTable(algo, pattern, firstStep) {
  const container = document.getElementById('aux-table-container');
  const title = document.getElementById('aux-title');

  if (algo === 'kmp') {
    title.textContent = 'TABELA LPS (Longest Proper Prefix Suffix) — KMP';
    const lps = computeLPS(pattern);

    // Linha de índices, linha de chars, linha de valores LPS
    let html = '<table id="aux-table"><thead><tr><th>i</th>';
    for (let i = 0; i < pattern.length; i++) html += `<th>${i}</th>`;
    html += '</tr><tr><th>char</th>';
    for (let i = 0; i < pattern.length; i++) html += `<th>${pattern[i]}</th>`;
    html += '</tr></thead><tbody><tr><th>LPS</th>';
    for (let i = 0; i < lps.length; i++) html += `<td>${lps[i]}</td>`;
    html += '</tr></tbody></table>';
    container.innerHTML = html;

  } else if (algo === 'bm') {
    title.textContent = 'TABELA BAD CHARACTER — Boyer-Moore';
    const badChar = buildBadChar(pattern);
    const chars = Object.keys(badChar);

    // Uma coluna por caractere presente no padrão
    let html = '<table id="aux-table"><thead><tr><th>Char</th>';
    chars.forEach(c => html += `<th>${c === ' ' ? '·' : c}</th>`);
    html += '</tr></thead><tbody><tr><th>Posição</th>';
    chars.forEach(c => html += `<td>${badChar[c]}</td>`);
    html += '</tr></tbody></table>';
    container.innerHTML = html;

  } else if (algo === 'rabin') {
    title.textContent = 'HASH DO PADRÃO — Rabin-Karp';
    const q = 101, d = 256;
    let p = 0;
    // Recalcula o hash do padrão (fórmula de Horner) para exibição
    for (let i = 0; i < pattern.length; i++) p = (d * p + pattern.charCodeAt(i)) % q;

    container.innerHTML = `
      <div style="font-family:'Space Mono',monospace;font-size:12px;color:var(--text2);line-height:2">
        <div>Base (d): <span style="color:var(--accent3)">256</span></div>
        <div>Módulo (q): <span style="color:var(--accent3)">101</span></div>
        <div>Hash do padrão "<span style="color:var(--accent3)">${pattern}</span>":
          <span style="color:var(--green);font-size:16px;font-weight:bold">${p}</span>
        </div>
        <div style="margin-top:12px;color:var(--text3);font-size:10px">
          O hash do texto deslizante é recalculado em O(1) por posição usando rolling hash.
        </div>
      </div>
    `;

  } else {
    // Naive: sem estrutura auxiliar
    title.textContent = 'ESTRUTURA AUXILIAR — Naive (sem estrutura adicional)';
    container.innerHTML = `
      <div style="font-family:'Space Mono',monospace;font-size:12px;color:var(--text3);padding:20px;text-align:center">
        O algoritmo Naive não utiliza estruturas auxiliares.<br>
        Compara diretamente texto[i..i+m] com o padrão.
      </div>
    `;
  }
}


// ===================== MODO PASSO A PASSO =====================

/**
 * Inicializa o modo passo a passo: gera os passos e prepara a UI.
 * O usuário pode então avançar/retroceder passo a passo ou usar o automático.
 */
function initStepByStep() {
  const text = getText();
  const pattern = getPattern();

  if (!text || !pattern) {
    setStatus('⚠ Insira o texto e o padrão.', 'error');
    return;
  }

  const algo = document.getElementById('algo-select').value;
  if (algo === 'all') {
    setStatus('⚠ Selecione um algoritmo específico para o modo passo a passo.', 'error');
    return;
  }

  appText = text;
  appPattern = pattern;
  currentAlgo = algo;

  // Gera TODOS os passos de uma vez e os armazena em memória
  steps = generateSteps(algo, text, pattern);
  currentStep = -1;
  foundPositions = [];
  clearLog();

  renderText(text);
  renderPattern(pattern);
  buildAuxTable(algo, pattern, steps[0]);
  updateComplexityHighlight(algo);

  document.getElementById('m-textlen').textContent = text.length;
  document.getElementById('m-patlen').textContent = pattern.length;
  document.getElementById('m-algo').textContent = algo.toUpperCase();
  document.getElementById('m-comparisons').textContent = 0;
  document.getElementById('m-found').textContent = 0;
  document.getElementById('m-step').textContent = '0/' + steps.length;

  // Habilita os controles de navegação
  document.getElementById('btn-next').disabled = false;
  document.getElementById('btn-prev').disabled = true;
  document.getElementById('btn-auto').disabled = false;
  document.getElementById('result-positions').innerHTML =
    '<span style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--text3)">—</span>';

  setStatus(`Modo passo a passo: ${steps.length} passos. Use ▶ para avançar.`, 'idle');
}

/**
 * Aplica visualmente um passo específico da execução.
 * Atualiza highlights de texto/padrão, métricas, log e tabelas auxiliares.
 * @param {Object} step - Objeto de passo gerado pelo algoritmo
 */
function applyStep(step) {
  if (!step) return;

  // Aplica os highlights visuais no texto e no padrão
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

  // Acumula e exibe posições encontradas (incrementalmente)
  if (step.found && step.found.length > 0) {
    foundPositions = step.found;
    document.getElementById('m-found').textContent = foundPositions.length;
    showResultPositions(foundPositions);
  }

  // ── Highlight da célula consultada na tabela LPS (KMP) ──────────────────────
  if (currentAlgo === 'kmp' && step.lps) {
    const cells = document.querySelectorAll('#aux-table td');
    cells.forEach((c, i) => {
      c.classList.remove('highlight');
      if (i === step.lpsHighlight) c.classList.add('highlight');
    });
  }

  // ── Highlight do char consultado na tabela Bad Character (Boyer-Moore) ──────
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

  // Registra o passo no log
  const logType = step.type === 'found'    ? 'found'
                : step.type === 'mismatch' ? 'mismatch'
                : step.type === 'shift'    ? 'shift'
                : 'compare';
  log(currentStep + 1, logType, step.msg);

  document.getElementById('pattern-info').textContent = step.msg;

  // Atualiza o status de acordo com o tipo do passo
  if (step.type === 'found') {
    setStatus(`✓ Ocorrência encontrada na posição ${step.foundPos}! (${foundPositions.length} total)`, 'done');
  } else {
    setStatus(step.msg, 'running');
  }
}

/** Avança um passo na execução passo a passo. */
function nextStep() {
  if (currentStep >= steps.length - 1) {
    setStatus('✓ Execução concluída!', 'done');
    return;
  }
  currentStep++;
  applyStep(steps[currentStep]);

  document.getElementById('btn-prev').disabled = false;

  // Desabilita "próximo" e "auto" se chegou ao fim
  if (currentStep >= steps.length - 1) {
    document.getElementById('btn-next').disabled = true;
    document.getElementById('btn-auto').disabled = true;
  }
}

/** Retrocede um passo na execução passo a passo. */
function prevStep() {
  if (currentStep <= 0) return;
  currentStep--;
  applyStep(steps[currentStep]);

  document.getElementById('btn-next').disabled = false;
  document.getElementById('btn-auto').disabled = false;

  if (currentStep === 0) document.getElementById('btn-prev').disabled = true;
}

/**
 * Inicia a execução automática: avança um passo de cada vez,
 * com intervalo definido pelo slider de velocidade.
 */
function toggleAuto() {
  if (isAutoRunning) return;
  isAutoRunning = true;

  document.getElementById('btn-auto').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  setStatus('▶ Execução automática em andamento...', 'running');

  runAutoStep();
}

/**
 * Função recursiva que avança um passo e agenda o próximo via setTimeout.
 * Usa a velocidade definida no slider (em milissegundos).
 */
function runAutoStep() {
  if (!isAutoRunning || currentStep >= steps.length - 1) {
    isAutoRunning = false;
    document.getElementById('btn-pause').disabled = true;
    if (currentStep >= steps.length - 1) setStatus('✓ Execução automática concluída!', 'done');
    return;
  }

  nextStep();
  const speed = parseInt(document.getElementById('speed-slider').value);
  autoTimer = setTimeout(runAutoStep, speed); // Agenda o próximo passo
}

/** Pausa a execução automática. */
function pauseAuto() {
  isAutoRunning = false;
  clearTimeout(autoTimer);

  document.getElementById('btn-auto').disabled = false;
  document.getElementById('btn-pause').disabled = true;
  setStatus('⏸ Pausado.', 'idle');
}

/**
 * Reseta toda a aplicação para o estado inicial:
 * limpa texto, padrão, passos, resultados e UI.
 */
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
  document.getElementById('result-positions').innerHTML =
    '<span style="font-family:\'Space Mono\',monospace;font-size:11px;color:var(--text3)">—</span>';
  document.getElementById('aux-table-container').innerHTML =
    '<div style="color:var(--text3);font-family:\'Space Mono\',monospace;font-size:12px;padding:20px;text-align:center">Execute um algoritmo para ver a estrutura auxiliar</div>';
  document.getElementById('compare-content').innerHTML =
    '<div style="color:var(--text3);font-family:\'Space Mono\',monospace;font-size:12px;padding:20px;text-align:center">Execute com "Todos" ou individualmente para comparar</div>';

  clearLog();

  ['m-comparisons', 'm-time', 'm-found', 'm-step'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );
  ['m-textlen', 'm-patlen'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );
  document.getElementById('m-algo').textContent = '—';

  // Desabilita todos os botões de navegação
  document.getElementById('btn-next').disabled = true;
  document.getElementById('btn-prev').disabled = true;
  document.getElementById('btn-auto').disabled = true;
  document.getElementById('btn-pause').disabled = true;

  document.querySelectorAll('#complexity-tbody tr').forEach(tr => tr.classList.remove('active-row'));
  setStatus('Aguardando entrada de dados...', 'idle');
}


// ===================== DRAG & DROP =====================

/**
 * Implementa drag & drop na área de upload.
 * Simula um evento 'change' no file input para reutilizar o handler já existente.
 */
const uploadArea = document.querySelector('.upload-area');

uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--accent)'; // Feedback visual de hover
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = 'var(--border)';
});

uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--border)';
  // Injeta os arquivos dropped no file input e dispara o handler de change
  document.getElementById('file-input').files = e.dataTransfer.files;
  document.getElementById('file-input').dispatchEvent(new Event('change'));
});


// ===================== INICIALIZAÇÃO =====================

// Estado inicial dos botões e status ao carregar a página
setStatus('Aguardando entrada de dados...', 'idle');
document.getElementById('btn-next').disabled = true;
document.getElementById('btn-prev').disabled = true;
document.getElementById('btn-auto').disabled = true;
document.getElementById('btn-pause').disabled = true;


// =============================================================================
// CORREÇÃO DE ESCOPO: EXPOR FUNÇÕES AO ESCOPO GLOBAL (window)
// =============================================================================
//
// Módulos ES (type="module") rodam em escopo isolado — suas funções e variáveis
// NÃO ficam disponíveis em window automaticamente.
//
// O HTML usa chamadas inline como onclick="runSearch()", o que exige que a
// função esteja em window. A solução é atribuí-las explicitamente:
//
window.runSearch       = runSearch;
window.initStepByStep  = initStepByStep;
window.nextStep        = nextStep;
window.prevStep        = prevStep;
window.toggleAuto      = toggleAuto;
window.pauseAuto       = pauseAuto;
window.resetAll        = resetAll;
window.switchTab       = switchTab;
window.clearLog        = clearLog;

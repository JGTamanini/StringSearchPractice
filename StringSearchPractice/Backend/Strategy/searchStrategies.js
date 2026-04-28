// =============================================================================
// PADRÃO STRATEGY — Algoritmos de Busca em Strings
// =============================================================================
//
// Cada estratégia encapsula um algoritmo de busca e seus metadados.
// O script.js usa apenas a interface { execute, buildAuxTable, ... }
// sem precisar conhecer os detalhes de cada algoritmo.
//
// Para adicionar um novo algoritmo, basta criar um novo objeto de estratégia
// aqui e registrá-lo no mapa STRATEGIES — sem alterar nenhum outro arquivo.
// =============================================================================

import naiveSteps from '../Algoritmos/naive.js';
import rabinKarpSteps from '../Algoritmos/rabinKarp.js';
import kmpSteps, { computeLPS } from '../Algoritmos/kmp.js';
import boyerMooreSteps, { buildBadChar } from '../Algoritmos/boyerMoore.js';

// -----------------------------------------------------------------------------
// Definição das estratégias
// -----------------------------------------------------------------------------

const naiveStrategy = {
  key: 'naive',
  name: 'Naive',
  execute: (text, pattern) => naiveSteps(text, pattern),
  complexity: { best: 'O(nm)', avg: 'O(nm)', worst: 'O(nm)' },
  buildAuxTable(pattern) {
    return {
      title: 'ESTRUTURA AUXILIAR — Naive (sem estrutura adicional)',
      html: `<div class="aux-placeholder">O algoritmo Naive não utiliza estruturas auxiliares.<br>
             Compara diretamente texto[i..i+m] com o padrão.</div>`,
    };
  },
};

const rabinKarpStrategy = {
  key: 'rabin',
  name: 'Rabin-Karp',
  execute: (text, pattern) => rabinKarpSteps(text, pattern),
  complexity: { best: 'O(n+m)', avg: 'O(n+m)', worst: 'O(nm)' },
  buildAuxTable(pattern) {
    const q = 101, d = 256;
    let hash = 0;
    for (let i = 0; i < pattern.length; i++) {
      hash = (d * hash + pattern.charCodeAt(i)) % q;
    }
    return {
      title: 'HASH DO PADRÃO — Rabin-Karp',
      html: `
        <div class="aux-hash">
          <div>Base (d): <span class="aux-value">256</span></div>
          <div>Módulo (q): <span class="aux-value">101</span></div>
          <div>Hash de "<span class="aux-value">${pattern}</span>":
            <span class="aux-result">${hash}</span>
          </div>
          <div class="aux-note">O hash do texto deslizante é recalculado em O(1) por posição usando rolling hash.</div>
        </div>`,
    };
  },
};

const kmpStrategy = {
  key: 'kmp',
  name: 'KMP',
  execute: (text, pattern) => kmpSteps(text, pattern),
  complexity: { best: 'O(n+m)', avg: 'O(n+m)', worst: 'O(n+m)' },
  buildAuxTable(pattern) {
    const lps = computeLPS(pattern);
    let html = '<table id="aux-table"><thead><tr><th>i</th>';
    for (let i = 0; i < pattern.length; i++) html += `<th>${i}</th>`;
    html += '</tr><tr><th>char</th>';
    for (let i = 0; i < pattern.length; i++) html += `<th>${pattern[i]}</th>`;
    html += '</tr></thead><tbody><tr><th>LPS</th>';
    for (let i = 0; i < lps.length; i++) html += `<td>${lps[i]}</td>`;
    html += '</tr></tbody></table>';
    return { title: 'TABELA LPS (Longest Proper Prefix Suffix) — KMP', html };
  },
};

const boyerMooreStrategy = {
  key: 'bm',
  name: 'Boyer-Moore',
  execute: (text, pattern) => boyerMooreSteps(text, pattern),
  complexity: { best: 'O(n/m)', avg: 'O(n)', worst: 'O(nm)' },
  buildAuxTable(pattern) {
    const badChar = buildBadChar(pattern);
    const chars = Object.keys(badChar);
    let html = '<table id="aux-table"><thead><tr><th>Char</th>';
    chars.forEach(c => { html += `<th>${c === ' ' ? '·' : c}</th>`; });
    html += '</tr></thead><tbody><tr><th>Posição</th>';
    chars.forEach(c => { html += `<td>${badChar[c]}</td>`; });
    html += '</tr></tbody></table>';
    return { title: 'TABELA BAD CHARACTER — Boyer-Moore', html };
  },
};

// -----------------------------------------------------------------------------
// Registro central das estratégias
// -----------------------------------------------------------------------------

export const STRATEGIES = {
  naive: naiveStrategy,
  rabin: rabinKarpStrategy,
  kmp:   kmpStrategy,
  bm:    boyerMooreStrategy,
};

/**
 * Retorna a estratégia pelo key. Lança erro se não encontrada.
 * @param {string} key
 * @returns {Object} estratégia
 */
export function getStrategy(key) {
  const strategy = STRATEGIES[key];
  if (!strategy) throw new Error(`Estratégia desconhecida: "${key}"`);
  return strategy;
}

/** Lista de todas as estratégias disponíveis (exceto 'all'). */
export const ALL_STRATEGY_KEYS = Object.keys(STRATEGIES);

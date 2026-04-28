/**
 * Boyer-Moore — Heurística Bad Character
 *
 * Compara o padrão da direita para a esquerda. Ao encontrar mismatch,
 * usa a tabela Bad Character para calcular o maior salto possível.
 * Shift = max(1, j - badChar[texto[i+j]])
 *
 * Complexidade: O(n/m) melhor caso, O(n·m) pior caso, O(σ) espaço.
 */

/**
 * Constrói a tabela Bad Character para o padrão.
 * Para cada caractere, armazena o índice de sua última ocorrência no padrão.
 *
 * @param {string} pattern
 * @returns {Object} mapa { char → última posição }
 */
export function buildBadChar(pattern) {
  const table = {};
  for (let i = 0; i < pattern.length - 1; i++) {
    table[pattern[i]] = i;
  }
  return table;
}

/**
 * Gera os passos do Boyer-Moore para visualização.
 *
 * @param {string} text
 * @param {string} pattern
 * @returns {Array}
 */
function boyerMooreSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;
  const badChar = buildBadChar(pattern);

  let compCount = 0;
  let i = 0;
  const found = [];

  while (i <= n - m) {
    let j = m - 1; // compara da direita para a esquerda

    while (j >= 0 && pattern[j] === text[i + j]) {
      compCount++;
      const highlights = {};
      highlights[i + j] = 'match';

      steps.push({
        type: 'match',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' == padrão[${j}]='${pattern[j]}' → MATCH`,
        textHighlights: highlights,
        patternActive: j,
        matchedUntil: j,
        comparisons: compCount,
        found: [...found],
        badChar,
      });

      j--;
    }

    if (j < 0) {
      const fH = {};
      for (let k = i; k < i + m; k++) fH[k] = 'full-match';
      found.push(i);

      steps.push({
        type: 'found',
        msg: `✓ PADRÃO ENCONTRADO em i=${i}!`,
        textHighlights: fH,
        patternActive: -1,
        matchedUntil: m - 1,
        comparisons: compCount,
        found: [...found],
        foundPos: i,
        badChar,
      });

      i += (m - 1 - (badChar[text[i + m]] ?? -1));

    } else {
      compCount++;
      const bc = badChar[text[i + j]] ?? -1;
      const shift = Math.max(1, j - bc);

      const highlights = {};
      highlights[i + j] = 'mismatch';

      steps.push({
        type: 'mismatch',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' != padrão[${j}]='${pattern[j]}' → Bad Char='${text[i+j]}', pos=${bc} → SHIFT ${shift}`,
        textHighlights: highlights,
        patternActive: j,
        matchedUntil: j + 1,
        patternMismatch: j,
        comparisons: compCount,
        found: [...found],
        badChar,
        badCharHighlight: text[i + j],
      });

      i += shift;
    }
  }

  return steps;
}

export default boyerMooreSteps;

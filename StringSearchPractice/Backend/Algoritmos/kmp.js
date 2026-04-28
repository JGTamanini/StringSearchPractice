/**
 * KMP — Knuth-Morris-Pratt
 *
 * Usa a tabela LPS (Longest Proper Prefix which is also Suffix) para evitar
 * retroceder o ponteiro do texto após um mismatch: j recua via LPS, i avança sempre.
 *
 * Complexidade: O(n+m) todos os casos, O(m) espaço.
 */

/**
 * Constrói a tabela LPS para o padrão.
 * LPS[j] = comprimento do maior prefixo próprio de pattern[0..j] que é também sufixo.
 *
 * @param {string} pattern
 * @returns {number[]}
 */
export function computeLPS(pattern) {
  const m = pattern.length;
  const lps = new Array(m).fill(0);
  let len = 0;
  let i = 1;

  while (i < m) {
    if (pattern[i] === pattern[len]) {
      lps[i++] = ++len;
    } else if (len > 0) {
      len = lps[len - 1]; // tenta prefixo-sufixo mais curto sem avançar i
    } else {
      lps[i++] = 0;
    }
  }

  return lps;
}

/**
 * Gera os passos do KMP para visualização.
 *
 * @param {string} text
 * @param {string} pattern
 * @returns {Array}
 */
function kmpSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;
  const lps = computeLPS(pattern);

  let compCount = 0;
  let i = 0; // ponteiro no texto — nunca retrocede
  let j = 0; // ponteiro no padrão — recua via LPS
  const found = [];

  while (i < n) {
    compCount++;
    const isMatch = text[i] === pattern[j];

    const highlights = {};
    highlights[i] = isMatch ? 'match' : 'mismatch';

    steps.push({
      type: isMatch ? 'match' : (j > 0 ? 'shift' : 'mismatch'),
      msg: isMatch
        ? `i=${i}, j=${j} → '${text[i]}' == '${pattern[j]}' → MATCH`
        : (j > 0
          ? `i=${i}, j=${j} → MISMATCH → usando LPS[${j-1}]=${lps[j-1]}, j volta para ${lps[j-1]}`
          : `i=${i}, j=0 → '${text[i]}' != '${pattern[j]}' → MISMATCH, avança i`),
      textHighlights: highlights,
      patternActive: j,
      matchedUntil: j - 1,
      patternMismatch: isMatch ? -1 : j,
      comparisons: compCount,
      found: [...found],
      lps,
      lpsHighlight: j > 0 && !isMatch ? j - 1 : -1,
    });

    if (isMatch) {
      i++;
      j++;
    } else if (j > 0) {
      j = lps[j - 1];
      continue;
    } else {
      i++;
    }

    if (j === m) {
      const pos = i - m;
      found.push(pos);

      const fH = {};
      for (let k = pos; k < pos + m; k++) fH[k] = 'full-match';

      steps.push({
        type: 'found',
        msg: `✓ PADRÃO ENCONTRADO na posição ${pos}! j volta para LPS[${m-1}]=${lps[m-1]}`,
        textHighlights: fH,
        patternActive: -1,
        matchedUntil: m - 1,
        comparisons: compCount,
        found: [...found],
        foundPos: pos,
        lps,
        lpsHighlight: m - 1,
      });

      j = lps[j - 1];
    }
  }

  return steps;
}

export default kmpSteps;

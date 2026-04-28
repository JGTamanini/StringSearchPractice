/**
 * Busca Ingênua (Força Bruta)
 * Compara o padrão em todas as posições do texto, caractere a caractere.
 * Complexidade: O(n·m) pior caso, O(1) espaço auxiliar.
 */
function naiveSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;
  let compCount = 0;

  for (let i = 0; i <= n - m; i++) {
    let matched = 0;

    for (let j = 0; j < m; j++) {
      compCount++;
      const isMatch = text[i + j] === pattern[j];

      const highlights = {};
      for (let k = 0; k < j; k++) highlights[i + k] = 'match';
      highlights[i + j] = isMatch ? 'match' : 'mismatch';
      for (let k = i + j + 1; k < i + m; k++) highlights[k] = 'comparing';

      steps.push({
        type: isMatch ? 'match' : 'mismatch',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' vs padrão[${j}]='${pattern[j]}' → ${isMatch ? '✓ MATCH' : '✗ MISMATCH'}`,
        textHighlights: highlights,
        patternActive: j,
        patternMatched: isMatch ? j : -1,
        patternMismatch: isMatch ? -1 : j,
        matchedUntil: isMatch ? j : j - 1,
        comparisons: compCount,
        found: [],
        offset: i,
      });

      if (!isMatch) { matched = -1; break; }
      matched = j;
    }

    if (matched === m - 1) {
      const fHighlights = {};
      for (let k = i; k < i + m; k++) fHighlights[k] = 'full-match';

      steps.push({
        type: 'found',
        msg: `✓ PADRÃO ENCONTRADO na posição ${i}!`,
        textHighlights: fHighlights,
        patternActive: -1,
        matchedUntil: m - 1,
        comparisons: compCount,
        found: steps.filter(s => s.type === 'found').map(s => s.foundPos).concat([i]),
        foundPos: i,
        offset: i,
      });
    }
  }

  return steps;
}

export default naiveSteps;

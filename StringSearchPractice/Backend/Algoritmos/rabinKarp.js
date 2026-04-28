/**
 * Rabin-Karp — Busca por Hashing com Rolling Hash
 *
 * Converte padrão e janelas do texto em hashes (O(1) por comparação).
 * Usa rolling hash para atualizar o hash da janela em O(1) a cada passo.
 * Confirma char a char apenas quando os hashes coincidem (evita falsos positivos).
 *
 * Complexidade: O(n+m) caso médio, O(n·m) pior caso, O(1) espaço.
 */
function rabinKarpSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;

  const q = 101; // módulo primo
  const d = 256; // base (ASCII)

  let compCount = 0;

  // h = d^(m-1) % q: peso do caractere mais à esquerda da janela
  let h = 1;
  for (let i = 0; i < m - 1; i++) h = (h * d) % q;

  // hashes iniciais do padrão e da primeira janela do texto
  let p = 0;
  let t = 0;
  for (let i = 0; i < m; i++) {
    p = (d * p + pattern.charCodeAt(i)) % q;
    t = (d * t + text.charCodeAt(i)) % q;
  }

  const found = [];

  for (let i = 0; i <= n - m; i++) {
    compCount++;
    const hashMatch = (p === t);

    if (hashMatch) {
      let j = 0;
      while (j < m && text[i + j] === pattern[j]) j++;
      const realMatch = (j === m);

      const highlights = {};
      for (let k = i; k < i + m; k++) highlights[k] = realMatch ? 'full-match' : 'comparing';

      steps.push({
        type: realMatch ? 'found' : 'mismatch',
        msg: realMatch
          ? `✓ HASH MATCH confirmado na posição ${i}! hash=${t}`
          : `Hash falso positivo em i=${i}: hash=${t} mas texto != padrão`,
        textHighlights: highlights,
        patternActive: -1,
        matchedUntil: realMatch ? m - 1 : -1,
        comparisons: compCount,
        found: realMatch ? [...found, i] : [...found],
        foundPos: realMatch ? i : undefined,
        hashText: t,
        hashPattern: p,
      });

      if (realMatch) found.push(i);

    } else {
      const highlights = {};
      for (let k = i; k < i + m; k++) highlights[k] = 'comparing';

      steps.push({
        type: 'compare',
        msg: `i=${i} → hash texto=${t} ≠ hash padrão=${p} → SKIP`,
        textHighlights: highlights,
        patternActive: 0,
        matchedUntil: -1,
        comparisons: compCount,
        found: [...found],
        hashText: t,
        hashPattern: p,
      });
    }

    // Rolling hash: remove char da esquerda, adiciona char da direita
    if (i < n - m) {
      t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
      if (t < 0) t += q;
    }
  }

  return steps;
}

export default rabinKarpSteps;

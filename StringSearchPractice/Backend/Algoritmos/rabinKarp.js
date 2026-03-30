// =============================================================================
// ALGORITMO DE RABIN-KARP (BUSCA POR HASHING COM ROLLING HASH)
// =============================================================================
//
// IDEIA CENTRAL:
//   Em vez de comparar o padrão caractere a caractere com cada janela do texto,
//   converte tanto o padrão quanto cada janela do texto em um número (hash).
//   Comparar dois números é O(1), muito mais rápido que comparar m caracteres.
//   Quando os hashes batem, faz a verificação real para evitar "falsos positivos"
//   (colisões de hash, onde hashes iguais mas strings diferentes).
//
//   O truque de eficiência é o ROLLING HASH: ao deslizar a janela uma posição
//   para a direita, o novo hash é calculado a partir do hash anterior em O(1),
//   sem precisar recalcular do zero.
//
// FÓRMULA DO HASH (polinomial/Horner):
//   hash("abc") = (a * d² + b * d¹ + c * d⁰) % q
//   onde:
//     d = base (256 → cobre todos os chars ASCII)
//     q = módulo primo (101 → reduz colisões, mantém valores pequenos)
//
// ROLLING HASH (remoção do char que saiu + adição do que entrou):
//   hash_novo = (d * (hash_velho - texto[i] * h) + texto[i + m]) % q
//   onde h = d^(m-1) % q  (fator do char mais à esquerda da janela)
//
// COMPLEXIDADE:
//   - Médio/melhor caso: O(n + m) → poucos falsos positivos
//   - Pior caso:         O(n · m) → muitos falsos positivos (ex: todos chars iguais)
//   - Espaço:            O(1)
//
// QUANDO USAR:
//   - Busca de múltiplos padrões de uma vez (extensão natural do algoritmo)
//   - Detecção de plágio / comparação de trechos de texto
//   - Quando o alfabeto é grande (ex: Unicode)
//
// EXEMPLO VISUAL (texto="ABCABD", padrão="ABD", d=256, q=101):
//
//   hash("ABD") = (65*256² + 66*256 + 68) % 101 = algum número H
//
//   Janela i=0: hash("ABC") → se ≠ H, skip → avança com rolling hash
//   Janela i=1: hash("BCA") → se ≠ H, skip
//   ...
//   Janela i=3: hash("ABD") → == H! → verifica char a char → ENCONTRADO
//
// =============================================================================

/**
 * Gera todos os passos do Rabin-Karp, para visualização passo a passo.
 *
 * @param {string} text    - O texto onde a busca será realizada
 * @param {string} pattern - O padrão que está sendo procurado
 * @returns {Array}        - Lista de objetos descrevendo cada passo da busca
 */
function rabinKarpSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;

  // ─── PARÂMETROS DO HASH ──────────────────────────────────────────────────────
  const q = 101;  // Módulo primo: reduz colisões e mantém os hashes em range pequeno
  const d = 256;  // Base: número de símbolos possíveis (ASCII completo)

  let compCount = 0;

  // ─── PRÉ-CÁLCULO DE h = d^(m-1) % q ─────────────────────────────────────────
  // h é o peso do caractere mais à esquerda da janela.
  // Usado no rolling hash para "remover" o char que sai da janela.
  // Exemplo: se m=3, h = d^2 % q = 256² % 101
  let h = 1;
  for (let i = 0; i < m - 1; i++) h = (h * d) % q;

  // ─── CÁLCULO DOS HASHES INICIAIS (janela inicial e padrão) ───────────────────
  // Usa o método de Horner: hash = (...((c0*d + c1)*d + c2)*d + ...) % q
  // Isso evita calcular potências de d explicitamente.
  let p = 0; // Hash do padrão (fixo durante toda a busca)
  let t = 0; // Hash da janela atual do texto (será atualizado com rolling hash)

  for (let i = 0; i < m; i++) {
    p = (d * p + pattern.charCodeAt(i)) % q;
    t = (d * t + text.charCodeAt(i)) % q;
  }

  const found = []; // Posições onde o padrão foi encontrado

  // ─── LOOP PRINCIPAL ──────────────────────────────────────────────────────────
  // i é o início da janela atual no texto
  for (let i = 0; i <= n - m; i++) {
    compCount++;

    const hashMatch = (p === t); // Compara os hashes: O(1) !

    if (hashMatch) {
      // ── HASH BATEU: verificar se é match real ou falso positivo ──────────────
      // Colisão de hash (falso positivo) ocorre quando dois strings diferentes
      // geram o mesmo hash. Por isso precisamos confirmar char a char.
      let j = 0;
      while (j < m && text[i + j] === pattern[j]) j++;
      const realMatch = (j === m); // true se TODOS os chars batem

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
        hashText: t,       // Hash da janela atual (para mostrar na UI)
        hashPattern: p,    // Hash do padrão (para comparação visual)
      });

      if (realMatch) found.push(i);

    } else {
      // ── HASH NÃO BATEU: janela inteira é descartada sem comparar chars ────────
      // Essa é a grande vantagem: O(1) para descartar m caracteres de uma vez!
      const highlights = {};
      for (let k = i; k < i + m; k++) highlights[k] = 'comparing';

      steps.push({
        type: 'compare',
        msg: `i=${i} → hash texto=${t} ≠ hash padrão=${p} → SKIP (sem comparações char a char)`,
        textHighlights: highlights,
        patternActive: 0,
        matchedUntil: -1,
        comparisons: compCount,
        found: [...found],
        hashText: t,
        hashPattern: p,
      });
    }

    // ─── ROLLING HASH: calcula o hash da próxima janela em O(1) ─────────────────
    // Fórmula:
    //   t_novo = (d * (t - texto[i] * h) + texto[i + m]) % q
    //
    // Passo a passo:
    //   1. (t - texto[i] * h)  → remove o char mais à esquerda (texto[i])
    //   2. * d                 → "desloca" os chars restantes uma posição à esquerda
    //   3. + texto[i + m]      → adiciona o novo char à direita
    //   4. % q                 → mantém no range do módulo
    //   5. if (t < 0) t += q  → corrige resultado negativo (JS pode retornar neg no %)
    if (i < n - m) {
      t = (d * (t - text.charCodeAt(i) * h) + text.charCodeAt(i + m)) % q;
      if (t < 0) t += q; // Garante que o hash seja sempre positivo
    }
  }

  return steps;
}

// Exporta a função para ser importada pelo script.js principal
export default rabinKarpSteps;

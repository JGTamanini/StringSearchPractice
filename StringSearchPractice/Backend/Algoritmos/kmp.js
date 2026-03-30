// =============================================================================
// ALGORITMO KMP — KNUTH-MORRIS-PRATT
// =============================================================================
//
// IDEIA CENTRAL:
//   O Naive reinicia do zero após cada mismatch, desperdiçando comparações.
//   O KMP aproveita o que já foi comparado: quando há um mismatch na posição j
//   do padrão, ele consulta a tabela LPS para saber QUANTO do padrão já
//   está alinhado com o texto — e pula direto para lá, sem retroceder i.
//
//   Resultado: i nunca volta para trás → O(n + m) garantido.
//
// ─── A TABELA LPS (Longest Proper Prefix which is also Suffix) ───────────────
//
//   Para cada posição j do padrão, LPS[j] = comprimento do maior prefixo
//   PRÓPRIO (≠ string inteira) de padrão[0..j] que também é sufixo de padrão[0..j].
//
//   Exemplo: padrão = "ABABC"
//     j=0: "A"     → sem prefixo próprio → LPS[0] = 0
//     j=1: "AB"    → prefixos: "A"; sufixos: "B" → nenhum comum → LPS[1] = 0
//     j=2: "ABA"   → prefixos: "A","AB"; sufixos: "A","BA" → "A" é comum → LPS[2] = 1
//     j=3: "ABAB"  → prefixos: "A","AB","ABA"; sufixos: "B","AB","BAB" → "AB" → LPS[3] = 2
//     j=4: "ABABC" → nenhum prefixo é sufixo → LPS[4] = 0
//
//   LPS = [0, 0, 1, 2, 0]
//
//   INTERPRETAÇÃO: se há mismatch em j=3, o LPS[2]=1 diz que podemos
//   continuar a comparação em j=1, porque padrão[0..0] já está alinhado.
//
// ─── COMO O KMP USA O LPS ────────────────────────────────────────────────────
//
//   Texto:   A B A B A B C A B A B
//   Padrão:  A B A B C
//
//   i=0,j=0: A==A ✓  i=1,j=1: B==B ✓  i=2,j=2: A==A ✓  i=3,j=3: B==B ✓
//   i=4,j=4: A≠C ✗  → LPS[3]=2 → j volta para 2 (NÃO volta i!)
//   i=4,j=2: A==A ✓  i=5,j=3: B==B ✓  i=6,j=4: C==C ✓  → ENCONTRADO em i=2!
//
// COMPLEXIDADE:
//   - Todos os casos: O(n + m)  → O(m) para construir LPS + O(n) para buscar
//   - Espaço:         O(m)      → apenas o array LPS
//
// QUANDO USAR:
//   - Textos longos com padrões repetitivos
//   - Streaming de dados (i nunca retrocede → processa 1 char por vez)
//   - Alfabetos pequenos (ex: DNA: A,C,G,T) onde há muita repetição
//
// =============================================================================

/**
 * Constrói a tabela LPS (Longest Proper Prefix which is also Suffix).
 *
 * Algoritmo:
 *   - len rastreia o comprimento do prefixo-sufixo atual
 *   - i percorre o padrão a partir do índice 1 (LPS[0] é sempre 0)
 *   - Se padrão[i] == padrão[len]: encontrou extensão → LPS[i] = ++len
 *   - Se não e len > 0: tenta encurtar usando LPS[len-1] (sem avançar i)
 *   - Se não e len == 0: LPS[i] = 0, avança i
 *
 * @param {string} pattern - O padrão para construir a tabela LPS
 * @returns {number[]}     - Array LPS de comprimento igual ao padrão
 */
export function computeLPS(pattern) {
  const m = pattern.length;
  const lps = new Array(m).fill(0); // LPS[0] é sempre 0 por definição

  let len = 0; // Comprimento do prefixo-sufixo atual sendo avaliado
  let i = 1;   // Começa em 1 (posição 0 é trivialmente 0)

  while (i < m) {
    if (pattern[i] === pattern[len]) {
      // Os chars batem: o prefixo-sufixo se extende em 1
      // Ex: padrão="ABAB", i=3, len=1 → 'B'=='B' → LPS[3]=2
      lps[i++] = ++len;

    } else if (len > 0) {
      // Mismatch mas ainda há prefixo-sufixo menor para tentar.
      // Em vez de zerar, tenta o próximo prefixo-sufixo mais curto.
      // (não incrementa i — testa a mesma posição com len menor)
      len = lps[len - 1];

    } else {
      // Mismatch e len==0: sem prefixo-sufixo possível nesta posição
      lps[i++] = 0;
    }
  }

  return lps;
}

/**
 * Gera todos os passos do KMP, para visualização passo a passo.
 *
 * @param {string} text    - O texto onde a busca será realizada
 * @param {string} pattern - O padrão que está sendo procurado
 * @returns {Array}        - Lista de objetos descrevendo cada passo da busca
 */
function kmpSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;

  // ─── PRÉ-PROCESSAMENTO ───────────────────────────────────────────────────────
  // Constrói a tabela LPS em O(m). Esse custo é pago uma vez e amortizado
  // em toda a busca — especialmente vantajoso ao buscar o mesmo padrão
  // em múltiplos textos.
  const lps = computeLPS(pattern);

  let compCount = 0;
  let i = 0; // Ponteiro no texto  — NUNCA retrocede
  let j = 0; // Ponteiro no padrão — pode retroceder via LPS
  const found = [];

  // ─── LOOP PRINCIPAL ──────────────────────────────────────────────────────────
  // i avança sempre que há match. Quando há mismatch, j salta via LPS,
  // mas i permanece no lugar — essa é a chave da eficiência do KMP.
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
          // Mismatch com j>0: LPS diz o quanto do padrão ainda está alinhado
          ? `i=${i}, j=${j} → MISMATCH → usando LPS[${j-1}]=${lps[j-1]}, j volta para ${lps[j-1]}`
          // Mismatch com j=0: nenhum prefixo aproveitável, avança i
          : `i=${i}, j=0 → '${text[i]}' != '${pattern[j]}' → MISMATCH, avança i`),
      textHighlights: highlights,
      patternActive: j,
      matchedUntil: j - 1,       // Chars do padrão já confirmados antes deste
      patternMismatch: isMatch ? -1 : j,
      comparisons: compCount,
      found: [...found],
      lps,                        // Tabela LPS completa (para visualização)
      lpsHighlight: j > 0 && !isMatch ? j - 1 : -1, // Célula do LPS consultada
    });

    if (isMatch) {
      // Match: avança ambos os ponteiros
      i++;
      j++;
    } else if (j > 0) {
      // Mismatch com j>0: usa LPS para "pular" — j recua, mas i fica parado.
      // LPS[j-1] diz: "os primeiros LPS[j-1] chars do padrão já estão alinhados
      // com o texto nesta posição" → não precisamos re-comparar esses chars.
      j = lps[j - 1];
      continue; // Não avança i — testa novamente com o novo j
    } else {
      // Mismatch com j=0: nem o 1º char bateu — simplesmente avança i
      i++;
    }

    // ─── OCORRÊNCIA ENCONTRADA ─────────────────────────────────────────────────
    // j chegou ao fim do padrão → encontramos o padrão terminando em i-1,
    // portanto começando em i - m.
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
        lpsHighlight: m - 1, // Última célula consultada: LPS[m-1]
      });

      // Após encontrar, j recua via LPS[m-1] para buscar sobreposições.
      // Ex: padrão="ABA" em texto="ABABA" → encontra em 0 E em 2 (sobrepostos)
      j = lps[j - 1];
    }
  }

  return steps;
}

// Exporta as funções para serem importadas pelo script.js principal
export default kmpSteps;

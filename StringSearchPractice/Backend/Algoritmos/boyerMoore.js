// =============================================================================
// ALGORITMO BOYER-MOORE (SIMPLIFICADO — APENAS BAD CHARACTER)
// =============================================================================
//
// IDEIA CENTRAL:
//   Ao contrário do Naive e do KMP que comparam da esquerda para a direita,
//   o Boyer-Moore compara o padrão da DIREITA PARA A ESQUERDA.
//   Isso permite detectar mismatches com chars do texto que nunca aparecem
//   no padrão — e pular a janela inteira de uma vez.
//
//   Esta implementação usa apenas a heurística BAD CHARACTER (a mais simples).
//   A versão completa do Boyer-Moore usa também GOOD SUFFIX, que melhora
//   ainda mais o desempenho em textos com padrões muito repetitivos.
//
// ─── HEURÍSTICA BAD CHARACTER ────────────────────────────────────────────────
//
//   Quando há mismatch entre texto[i+j] e padrão[j] (comparando da direita):
//
//   O char problemático é texto[i+j] → chamado de "bad character".
//
//   Duas situações:
//
//   1. O bad character NÃO existe no padrão:
//      → Pode pular a janela inteira (shift = j + 1)
//      Ex: texto="ABCDE", padrão="XYZ" → mismatch em 'E' (não está em "XYZ")
//          → pula 3 posições
//
//   2. O bad character EXISTE no padrão (à esquerda do ponto de mismatch):
//      → Alinha a última ocorrência do char no padrão com o char do texto
//      Ex: texto="...B...", padrão="ABCD", mismatch em j=3
//          'B' está no padrão em posição 1 → shift = j - 1 = 2
//
//   Fórmula do shift: max(1, j - badChar[texto[i+j]])
//     - badChar[c] = última posição de c no padrão (excluindo última pos)
//     - Se c não está no padrão, badChar[c] = -1 → shift = j + 1
//     - max(1, ...) garante que sempre avançamos pelo menos 1 posição
//
// ─── A TABELA BAD CHARACTER ──────────────────────────────────────────────────
//
//   Construída em O(m): para cada char do padrão (exceto o último),
//   armazena o índice de sua ÚLTIMA ocorrência.
//
//   Exemplo: padrão = "ABCABD"
//     A → 3 (última ocorrência antes do fim)
//     B → 4
//     C → 2
//     D → 5  (mas na prática D é o último, então não entra na tabela)
//     → tabela = { A:3, B:4, C:2 }
//
// COMPLEXIDADE:
//   - Melhor caso:  O(n/m) → salta m posições por vez (padrão não tem chars do texto)
//   - Médio caso:   O(n)
//   - Pior caso:    O(n·m) → texto="AAAAAAA", padrão="AAA" (muitos matches parciais)
//   - Espaço:       O(σ)   → σ = tamanho do alfabeto
//
// QUANDO USAR:
//   - Textos em linguagem natural (alfabeto grande → poucos falsos alinhamentos)
//   - Padrões longos (mais chars para comparar → saltos maiores)
//   - Editores de texto (grep, find, etc. usam variantes do Boyer-Moore)
//
// EXEMPLO VISUAL (texto="ABCBDAB", padrão="BDA"):
//
//   Alinhamento inicial:    A B C B D A B
//                           B D A
//   Compara da direita: j=2 → A==A ✓, j=1 → D==D... espera, B≠D.
//   Bad char = 'C' (texto[2]), não está em "BDA" → shift = 2 - (-1) = 3
//
//   Novo alinhamento:       A B C B D A B
//                                 B D A
//   j=2: B==A? ✗ — bad char = 'B', posição em padrão = 0 → shift = max(1, 2-0) = 2
//
//   Novo alinhamento:       A B C B D A B
//                                     B D A
//   j=2: A==A ✓, j=1: D==D ✓, j=0: B==B ✓ → ENCONTRADO em posição 4!
//
// =============================================================================

/**
 * Constrói a tabela Bad Character para o padrão.
 *
 * Para cada caractere c, armazena o índice da sua ÚLTIMA ocorrência
 * no padrão (excluindo o último caractere, que nunca causa shift útil).
 * Chars ausentes no padrão ficam com valor -1 implicitamente (via ?? -1).
 *
 * @param {string} pattern - O padrão para construir a tabela
 * @returns {Object}       - Mapa { char → última posição no padrão }
 */
export function buildBadChar(pattern) {
  const table = {};

  // Itera até m-2 (exclui o último char) porque o bad character
  // é definido para a posição de mismatch, não o último char.
  // Iterar até m-1 sobrescreveria corretamente a última ocorrência de cada char.
  for (let i = 0; i < pattern.length - 1; i++) {
    table[pattern[i]] = i; // Sobrescreve → fica com a posição mais à direita
  }

  return table;
}

/**
 * Gera todos os passos do Boyer-Moore (Bad Character), para visualização.
 *
 * @param {string} text    - O texto onde a busca será realizada
 * @param {string} pattern - O padrão que está sendo procurado
 * @returns {Array}        - Lista de objetos descrevendo cada passo da busca
 */
function boyerMooreSteps(text, pattern) {
  const steps = [];
  const n = text.length;
  const m = pattern.length;

  // ─── PRÉ-PROCESSAMENTO ───────────────────────────────────────────────────────
  // Constrói a tabela bad character em O(m). Custo único, amortizado na busca.
  const badChar = buildBadChar(pattern);

  let compCount = 0;
  let i = 0;        // Posição de início da janela atual no texto
  const found = []; // Posições onde o padrão foi encontrado

  // ─── LOOP PRINCIPAL ──────────────────────────────────────────────────────────
  // i avança pela tabela, nunca retrocede (embora j percorra o padrão ao contrário)
  while (i <= n - m) {

    // ─── COMPARAÇÃO DA DIREITA PARA A ESQUERDA ─────────────────────────────────
    // j começa no último char do padrão e vai em direção a 0.
    // Isso maximiza a informação obtida por mismatch (chars do final do padrão
    // tendem a ser mais "específicos" e causam saltos maiores).
    let j = m - 1;

    while (j >= 0 && pattern[j] === text[i + j]) {
      compCount++;
      const highlights = {};
      highlights[i + j] = 'match';

      steps.push({
        type: 'match',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' == padrão[${j}]='${pattern[j]}' → MATCH`,
        textHighlights: highlights,
        patternActive: j,
        matchedUntil: j,       // Em BM, 'matchedUntil' conta da direita
        comparisons: compCount,
        found: [...found],
        badChar,
      });

      j--; // Avança para a esquerda no padrão
    }

    // ─── AVALIAÇÃO DO RESULTADO DA JANELA ─────────────────────────────────────
    if (j < 0) {
      // j < 0 significa que TODOS os chars do padrão foram comparados com sucesso
      // → padrão encontrado começando na posição i
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

      // Após encontrar, calcula o próximo shift usando o char logo após o padrão.
      // Se não houver char à direita, usa -1 (força shift de m).
      i += (m - 1 - (badChar[text[i + m]] ?? -1));

    } else {
      // Mismatch em posição j do padrão.
      // O bad character é texto[i+j] — o char do texto que causou o mismatch.
      compCount++;
      const bc = badChar[text[i + j]] ?? -1; // Posição do bad char no padrão (-1 se ausente)

      // Shift = max(1, j - bc)
      //   j - bc : alinha a última ocorrência do bad char no padrão com o texto
      //   max(1, ...): garante que sempre avançamos (evita shift 0 ou negativo)
      const shift = Math.max(1, j - bc);

      const highlights = {};
      highlights[i + j] = 'mismatch';

      steps.push({
        type: 'mismatch',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' != padrão[${j}]='${pattern[j]}' → Bad Char='${text[i+j]}', posição=${bc} → SHIFT ${shift}`,
        textHighlights: highlights,
        patternActive: j,
        matchedUntil: j + 1,    // Chars à direita de j já foram matched
        patternMismatch: j,
        comparisons: compCount,
        found: [...found],
        badChar,
        badCharHighlight: text[i + j], // Char do texto consultado na tabela (para UI)
      });

      // Aplica o shift: desloca a janela shift posições para a direita
      i += shift;
    }
  }

  return steps;
}

// Exporta as funções para serem importadas pelo script.js principal
export default boyerMooreSteps;

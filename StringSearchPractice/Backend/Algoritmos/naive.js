// =============================================================================
// ALGORITMO DE BUSCA INGÊNUA (NAIVE / FORÇA BRUTA)
// =============================================================================
//
// IDEIA CENTRAL:
//   Tenta encaixar o padrão em TODAS as posições possíveis do texto, uma por uma.
//   Para cada posição i do texto, compara o padrão caractere a caractere da
//   esquerda para a direita. Se algum caractere não bater, abandona essa posição
//   e move i uma casa para a frente. Repete até varrer todo o texto.
//
// COMPLEXIDADE:
//   - Melhor caso:  O(n)   → o padrão nunca aparece e já erra no 1º char
//   - Pior caso:    O(n·m) → ex: texto = "AAAAAAA", padrão = "AAAAB"
//                            (compara quase m chars por posição sem encontrar)
//   - Espaço:       O(1)   → nenhuma estrutura auxiliar
//
// QUANDO USAR:
//   - Textos e padrões curtos
//   - Implementação didática / ponto de partida
//   - Quando simplicidade é mais importante que performance
//
// EXEMPLO VISUAL (texto="ABCABD", padrão="ABD"):
//
//   Posição i=0:  A B C A B D
//                 A B D
//                 ✓ ✓ ✗  → mismatch em j=2 (C≠D), vai para i=1
//
//   Posição i=1:  A B C A B D
//                   A B D
//                   ✗      → mismatch em j=0 (B≠A), vai para i=2
//   ...
//   Posição i=3:  A B C A B D
//                         A B D
//                         ✓ ✓ ✓  → ENCONTRADO na posição 3!
//
// =============================================================================

/**
 * Gera todos os passos da busca ingênua, para visualização passo a passo.
 *
 * @param {string} text    - O texto onde a busca será realizada
 * @param {string} pattern - O padrão que está sendo procurado
 * @returns {Array}        - Lista de objetos descrevendo cada passo da busca
 */
function naiveSteps(text, pattern) {
  const steps = [];             // Armazena cada passo para a visualização
  const n = text.length;        // Comprimento do texto
  const m = pattern.length;     // Comprimento do padrão
  let compCount = 0;            // Contador de comparações realizadas

  // ─── LOOP EXTERNO ───────────────────────────────────────────────────────────
  // i percorre todas as posições onde o padrão PODERIA começar no texto.
  // O limite é (n - m) porque, se i > n - m, o padrão não cabe mais no texto.
  for (let i = 0; i <= n - m; i++) {

    let matched = 0; // Rastreia o último índice do padrão que deu match

    // ─── LOOP INTERNO ─────────────────────────────────────────────────────────
    // j percorre os caracteres do padrão, comparando com texto[i + j].
    // O alinhamento atual é: texto[ i .. i+m-1 ] vs padrão[ 0 .. m-1 ]
    for (let j = 0; j < m; j++) {
      compCount++;

      const isMatch = text[i + j] === pattern[j];

      // Monta o mapa de destaques visuais para a posição atual no texto:
      // - Caracteres já comparados e corretos → 'match'
      // - Caractere atual                    → 'match' ou 'mismatch'
      // - Caracteres do padrão ainda não vistos → 'comparing'
      const highlights = {};
      for (let k = 0; k < j; k++) highlights[i + k] = 'match';             // já matched
      highlights[i + j] = isMatch ? 'match' : 'mismatch';                  // atual
      for (let k = i + j + 1; k < i + m; k++) highlights[k] = 'comparing'; // pendentes

      // Registra o passo atual com todas as informações de visualização
      steps.push({
        type: isMatch ? 'match' : 'mismatch',
        msg: `i=${i}, j=${j} → texto[${i+j}]='${text[i+j]}' vs padrão[${j}]='${pattern[j]}' → ${isMatch ? '✓ MATCH' : '✗ MISMATCH'}`,
        textHighlights: highlights,
        patternActive: j,              // Índice do padrão sendo comparado agora
        patternMatched: isMatch ? j : -1,
        patternMismatch: isMatch ? -1 : j,
        matchedUntil: isMatch ? j : j - 1, // Até onde houve match contínuo
        comparisons: compCount,
        found: [],
        offset: i,                     // Posição atual de alinhamento no texto
      });

      // Se houve mismatch, não adianta continuar comparando nesta posição i.
      // O break encerra o loop interno; o externo avançará i em +1.
      if (!isMatch) {
        matched = -1;
        break;
      }

      matched = j;
    }

    // ─── OCORRÊNCIA ENCONTRADA ─────────────────────────────────────────────────
    // Se matched chegou ao último índice do padrão (m-1), todos os m
    // caracteres bateram → encontramos o padrão começando na posição i.
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

    // O loop externo avança i em +1 → a janela de comparação desliza uma posição.
    // Essa é a principal limitação do Naive: mesmo tendo comparado vários chars,
    // volta tudo do zero. KMP e Boyer-Moore evitam esse desperdício.
  }

  return steps;
}

// Exporta a função para ser importada pelo script.js principal
export default naiveSteps;

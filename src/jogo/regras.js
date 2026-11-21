// As mecanicas dos modelos. O tema (visual) e a mecanica sao independentes: qualquer tema roda com
// qualquer mecanica (modelos/jogar.html#tema=3&mec=1).
//
// 0 classico    - so o nucleo do genero (controle para comparar)
// 1 mana        - limpar enche o orbe; cheio, da um Feitico que limpa a linha e a coluna onde cair
// 2 quadrantes  - tabuleiro 9x9; quadrante 3x3 cheio tambem limpa
// 3 sabores     - cada peca tem um sabor; linha toda de um sabor vale x3
// 4 bombas      - a cada 8 pecas uma traz bomba-relogio (7 jogadas); se zerar vira entulho 3x3
// 5 estrelas    - a cada 4 jogadas uma estrela marca uma casa vazia; limpar a casa da x2 em 3 limpezas
// 6 girar       - um toque gira a peca 90 graus; em troca, saem pentominos estranhos
// 7 galaxia     - a do jogo final (Magic Block): girar + estrelas
//
// Modulo puro.

/**
 * @typedef {object} Regras
 * @property {string} id
 * @property {number} n lado do tabuleiro
 * @property {number} cores quantas cores (ou sabores) as pecas sorteiam
 * @property {boolean} [mana]
 * @property {boolean} [quadrantes]
 * @property {boolean} [sabores]
 * @property {boolean} [bombas]
 * @property {boolean} [estrelas]
 * @property {boolean} [girar]
 */

/** @type {readonly Regras[]} */
export const MECANICAS = Object.freeze([
  { id: 'classico', n: 8, cores: 6 },
  { id: 'mana', n: 8, cores: 6, mana: true },
  { id: 'quadrantes', n: 9, cores: 6, quadrantes: true },
  { id: 'sabores', n: 8, cores: 4, sabores: true },
  { id: 'bombas', n: 8, cores: 6, bombas: true },
  { id: 'estrelas', n: 8, cores: 6, estrelas: true },
  { id: 'girar', n: 8, cores: 6, girar: true },
  { id: 'galaxia', n: 8, cores: 6, girar: true, estrelas: true },
]);

/** A mecanica do jogo final. */
export const MEC_JOGO = 7;

/** Pontos por unidade limpa: 10 x quantas unidades sairam juntas (1 = 10, 2 = 40, 3 = 90). */
export const PONTOS_UNIDADE = 10;
/** Pontos por casa ocupada ao colocar. */
export const PONTOS_CASA = 1;
/** Jogadas seguidas sem limpar que quebram a sequencia (o combo). */
export const TOLERANCIA_SEQUENCIA = 3;
/** Linha de um sabor so vale isto vezes mais. */
export const MULT_PURA = 3;

/** Mana por unidade limpa e o extra por passo de sequencia. */
export const MANA_UNIDADE = 0.25;
export const MANA_SEQUENCIA = 0.1;
/** Pontos por bloco que o Feitico remove. */
export const PONTOS_FEITICO = 5;

/** A cada quantas pecas sorteadas uma traz bomba, e o contador dela (jogadas). */
export const BOMBA_CADA = 8;
export const BOMBA_CONTADOR = 7;

/** A cada quantas jogadas uma estrela e avisada (e cai na jogada seguinte). */
export const ESTRELA_CADA = 4;
/** Estrelas ao mesmo tempo no tabuleiro, no maximo. */
export const ESTRELA_MAX = 3;
/** Limpezas que valem x2 depois de coletar uma estrela. */
export const ESTRELA_LIMPEZAS = 3;

/** Bonus de tabuleiro limpo (nenhum bloco depois da limpeza), vezes a sequencia. */
export const PONTOS_PERFEITO = 300;
/** Quantas vezes por partida da para reviver (premio do video recompensado). */
export const REVIVER_MAX = 1;
/** Linhas e colunas mais cheias que o reviver esvazia. */
export const REVIVER_LINHAS = 2;

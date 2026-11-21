// Catalogo de pecas (poliminos) e geometria de grade. Base: hexadrop/src/physics/shapes.js
// (normalize, rotate90, orientations), com a linha crescendo para BAIXO (coordenada de tela).
//
// Uma forma e uma lista de celulas [coluna, linha] a partir de (0, 0). O sorteio escolhe uma forma
// base pelo peso e depois uma das orientacoes dela; a mecanica "girar" deixa o jogador trocar a
// orientacao com um toque.
//
// Modulo puro: sem DOM, relogio nem sorteio proprio.

/** @typedef {[number, number]} Celula */

/**
 * @typedef {object} FormaBase
 * @property {string} id
 * @property {Celula[]} cels
 * @property {number} peso peso no sorteio normal
 * @property {number} pesoGiro peso quando a mecanica "girar" esta ligada (formas estranhas sobem)
 */

/** @type {FormaBase[]} */
export const FORMAS = [
  { id: 'mono', peso: 2, pesoGiro: 1, cels: [[0, 0]] },
  { id: 'duo', peso: 6, pesoGiro: 3, cels: [[0, 0], [1, 0]] },
  { id: 'i3', peso: 6, pesoGiro: 3, cels: [[0, 0], [1, 0], [2, 0]] },
  { id: 'i4', peso: 5, pesoGiro: 3, cels: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: 'i5', peso: 3, pesoGiro: 3, cels: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: 'o4', peso: 6, pesoGiro: 3, cels: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: 'o9', peso: 2, pesoGiro: 2, cels: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] },
  { id: 'r6', peso: 3, pesoGiro: 2, cels: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { id: 'l3', peso: 6, pesoGiro: 3, cels: [[0, 0], [1, 0], [0, 1]] },
  { id: 'l4', peso: 6, pesoGiro: 4, cels: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { id: 't4', peso: 4, pesoGiro: 4, cels: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: 's4', peso: 3, pesoGiro: 4, cels: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { id: 'v5', peso: 4, pesoGiro: 3, cels: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  // pentominos estranhos: so aparecem (bastante) com a mecanica girar
  { id: 'u5', peso: 0, pesoGiro: 3, cels: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { id: 'p5', peso: 0, pesoGiro: 3, cels: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
  { id: 't5', peso: 0, pesoGiro: 3, cels: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: 'y5', peso: 0, pesoGiro: 2, cels: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]] },
  { id: 'n5', peso: 0, pesoGiro: 2, cels: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: 'w5', peso: 0, pesoGiro: 2, cels: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
  { id: 'x5', peso: 0, pesoGiro: 2, cels: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { id: 'z5', peso: 0, pesoGiro: 2, cels: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] },
];

/** @type {Record<string, FormaBase>} */
export const FORMA = {};
for (const f of FORMAS) FORMA[f.id] = f;

/**
 * Move as celulas para a origem e ordena (linha, coluna).
 * @param {Celula[]} cels
 * @returns {Celula[]}
 */
export function normalizar(cels) {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of cels) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  const out = cels.map(([x, y]) => /** @type {Celula} */ ([x - mx, y - my]));
  out.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
  return out;
}

/**
 * Gira 90 graus no sentido horario (na tela, com y para baixo).
 * @param {Celula[]} cels
 * @returns {Celula[]}
 */
export function girar90(cels) {
  return normalizar(cels.map(([x, y]) => /** @type {Celula} */ ([-y, x])));
}

/** @param {Celula[]} cels @returns {Celula[]} */
export function espelhar(cels) {
  return normalizar(cels.map(([x, y]) => /** @type {Celula} */ ([-x, y])));
}

/** @param {Celula[]} cels */
export function chave(cels) {
  return normalizar(cels).map(([x, y]) => x + ',' + y).join(';');
}

/**
 * Todas as orientacoes distintas (giros e espelhos).
 * @param {Celula[]} cels
 * @returns {Celula[][]}
 */
export function orientacoes(cels) {
  /** @type {Map<string, Celula[]>} */
  const vistas = new Map();
  const base = normalizar(cels);
  for (let m = 0; m < 2; m++) {
    let c = m === 0 ? base : espelhar(base);
    for (let r = 0; r < 4; r++) {
      const k = chave(c);
      if (!vistas.has(k)) vistas.set(k, c);
      c = girar90(c);
    }
  }
  return [...vistas.values()];
}

/** @param {Celula[]} cels @returns {{ w: number, h: number }} */
export function limites(cels) {
  let w = 0;
  let h = 0;
  for (const [x, y] of cels) {
    if (x + 1 > w) w = x + 1;
    if (y + 1 > h) h = y + 1;
  }
  return { w, h };
}

/** Orientacoes de cada forma, calculadas uma vez. @type {Record<string, Celula[][]>} */
export const ORIENTACOES = {};
for (const f of FORMAS) ORIENTACOES[f.id] = orientacoes(f.cels);

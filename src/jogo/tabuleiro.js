// Tabuleiro n x n em arrays planos (indice i = y * n + x).
// - cor[i]: 0 vazio, 1..K cor (ou sabor) do bloco, -1 entulho (pedra que so sai com a linha);
// - bomba[i]: contador da bomba-relogio naquele bloco (0 = sem bomba);
// - estrela[i]: 1 se ha uma estrela cadente marcada na casa (coletada quando a casa e limpa).
//
// Modulo puro.

export const VAZIO = 0;
export const ENTULHO = -1;

/**
 * @typedef {object} Tabuleiro
 * @property {number} n
 * @property {Int8Array} cor
 * @property {Int8Array} bomba
 * @property {Uint8Array} estrela
 */

/** @param {number} n @returns {Tabuleiro} */
export function criarTabuleiro(n) {
  return { n, cor: new Int8Array(n * n), bomba: new Int8Array(n * n), estrela: new Uint8Array(n * n) };
}

/** @param {Tabuleiro} t @returns {Tabuleiro} */
export function clonarTabuleiro(t) {
  return { n: t.n, cor: t.cor.slice(), bomba: t.bomba.slice(), estrela: t.estrela.slice() };
}

/**
 * A peca (celulas a partir de 0,0) cabe com o canto em (gx, gy)?
 * @param {Tabuleiro} t
 * @param {import('./formas.js').Celula[]} cels
 * @param {number} gx
 * @param {number} gy
 */
export function cabe(t, cels, gx, gy) {
  const n = t.n;
  for (const [cx, cy] of cels) {
    const x = gx + cx;
    const y = gy + cy;
    if (x < 0 || y < 0 || x >= n || y >= n) return false;
    if (t.cor[y * n + x] !== VAZIO) return false;
  }
  return true;
}

/**
 * Todos os cantos (gx, gy) onde a peca cabe.
 * @param {Tabuleiro} t
 * @param {import('./formas.js').Celula[]} cels
 * @returns {[number, number][]}
 */
export function lugares(t, cels) {
  /** @type {[number, number][]} */
  const out = [];
  for (let gy = 0; gy < t.n; gy++) for (let gx = 0; gx < t.n; gx++) if (cabe(t, cels, gx, gy)) out.push([gx, gy]);
  return out;
}

/** @param {Tabuleiro} t @param {import('./formas.js').Celula[]} cels */
export function temLugar(t, cels) {
  for (let gy = 0; gy < t.n; gy++) for (let gx = 0; gx < t.n; gx++) if (cabe(t, cels, gx, gy)) return true;
  return false;
}

/**
 * @typedef {object} Unidades linhas, colunas e quadrantes cheios
 * @property {number[]} linhas
 * @property {number[]} colunas
 * @property {number[]} quadrantes indice q = qy * (n / 3) + qx
 */

/**
 * Unidades cheias de um array de cores (com ou sem a peca nova escrita nele).
 * @param {Int8Array} cor
 * @param {number} n
 * @param {boolean} comQuadrantes
 * @returns {Unidades}
 */
export function unidadesCheias(cor, n, comQuadrantes) {
  /** @type {Unidades} */
  const u = { linhas: [], colunas: [], quadrantes: [] };
  for (let y = 0; y < n; y++) {
    let ok = true;
    for (let x = 0; x < n && ok; x++) if (cor[y * n + x] === VAZIO) ok = false;
    if (ok) u.linhas.push(y);
  }
  for (let x = 0; x < n; x++) {
    let ok = true;
    for (let y = 0; y < n && ok; y++) if (cor[y * n + x] === VAZIO) ok = false;
    if (ok) u.colunas.push(x);
  }
  if (comQuadrantes && n % 3 === 0) {
    const m = n / 3;
    for (let qy = 0; qy < m; qy++) {
      for (let qx = 0; qx < m; qx++) {
        let ok = true;
        for (let dy = 0; dy < 3 && ok; dy++) for (let dx = 0; dx < 3 && ok; dx++) {
          if (cor[(qy * 3 + dy) * n + qx * 3 + dx] === VAZIO) ok = false;
        }
        if (ok) u.quadrantes.push(qy * m + qx);
      }
    }
  }
  return u;
}

/** @param {Unidades} u */
export const totalUnidades = (u) => u.linhas.length + u.colunas.length + u.quadrantes.length;

/**
 * Indices das celulas de cada unidade (lista por unidade, na ordem linhas, colunas, quadrantes).
 * @param {Unidades} u
 * @param {number} n
 * @returns {{ tipo: 'linha'|'coluna'|'quadrante', k: number, cels: number[] }[]}
 */
export function celulasDasUnidades(u, n) {
  const out = [];
  for (const y of u.linhas) out.push({ tipo: /** @type {const} */ ('linha'), k: y, cels: Array.from({ length: n }, (_, x) => y * n + x) });
  for (const x of u.colunas) out.push({ tipo: /** @type {const} */ ('coluna'), k: x, cels: Array.from({ length: n }, (_, y) => y * n + x) });
  const m = n / 3;
  for (const q of u.quadrantes) {
    const qx = q % m;
    const qy = Math.floor(q / m);
    const cels = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) cels.push((qy * 3 + dy) * n + qx * 3 + dx);
    out.push({ tipo: /** @type {const} */ ('quadrante'), k: q, cels });
  }
  return out;
}

/**
 * O que limparia se a peca fosse colocada em (gx, gy), sem mexer no tabuleiro.
 * @param {Tabuleiro} t
 * @param {import('./formas.js').Celula[]} cels
 * @param {number} gx
 * @param {number} gy
 * @param {boolean} comQuadrantes
 * @returns {{ unidades: Unidades, celulas: Set<number> } | null} null se nao cabe
 */
export function previa(t, cels, gx, gy, comQuadrantes) {
  if (!cabe(t, cels, gx, gy)) return null;
  const cor = t.cor.slice();
  for (const [cx, cy] of cels) cor[(gy + cy) * t.n + gx + cx] = 1;
  const unidades = unidadesCheias(cor, t.n, comQuadrantes);
  const celulas = new Set();
  for (const g of celulasDasUnidades(unidades, t.n)) for (const i of g.cels) celulas.add(i);
  return { unidades, celulas };
}

/** @param {Tabuleiro} t */
export function ocupadas(t) {
  let c = 0;
  for (let i = 0; i < t.cor.length; i++) if (t.cor[i] !== VAZIO) c++;
  return c;
}

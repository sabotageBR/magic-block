// Sorteio das pecas da bandeja: forma pelo peso, orientacao, cor (sem repetir na mesma bandeja quando
// da), bomba-relogio (mecanica bombas) e a regra anti-frustracao: das 3 pecas novas, pelo menos uma
// cabe em algum lugar, quando isso for possivel.
//
// Modulo puro: o sorteio vem de E.rng (core/rng.js, com semente).

import { FORMAS, ORIENTACOES, girar90, normalizar } from './formas.js';
import { temLugar } from './tabuleiro.js';
import { BOMBA_CADA, BOMBA_CONTADOR } from './regras.js';

/**
 * @typedef {object} Peca
 * @property {number} id
 * @property {string} forma
 * @property {import('./formas.js').Celula[]} cels
 * @property {number} cor 1..K
 * @property {number} bomba indice da celula (em cels) com bomba, -1 sem bomba
 * @property {number} contador contador da bomba
 */

/** Tentativas de sortear uma bandeja com alguma peca que cabe antes de trocar uma peca a forca. */
const TENTATIVAS = 6;

/**
 * Escolhe uma forma base pelo peso e uma orientacao dela.
 * @param {() => number} rng
 * @param {boolean} giro pesos da mecanica girar
 * @returns {{ forma: string, cels: import('./formas.js').Celula[] }}
 */
export function sortearForma(rng, giro) {
  let total = 0;
  for (const f of FORMAS) total += giro ? f.pesoGiro : f.peso;
  let r = rng() * total;
  let escolhida = FORMAS[0];
  for (const f of FORMAS) {
    r -= giro ? f.pesoGiro : f.peso;
    if (r < 0) { escolhida = f; break; }
  }
  const ors = ORIENTACOES[escolhida.id];
  return { forma: escolhida.id, cels: ors[Math.floor(rng() * ors.length)] };
}

/**
 * A peca cabe em algum lugar (em alguma das 4 orientacoes, se a mecanica deixa girar)?
 * @param {import('./tabuleiro.js').Tabuleiro} t
 * @param {import('./formas.js').Celula[]} cels
 * @param {boolean} [giro]
 */
export function pecaCabe(t, cels, giro = false) {
  let c = cels;
  for (let k = 0; k < (giro ? 4 : 1); k++) {
    if (temLugar(t, c)) return true;
    c = girar90(c);
  }
  return false;
}

/**
 * Gira a peca 90 graus, levando a bomba junto com a celula dela.
 * @param {Peca} p
 */
export function girarPeca(p) {
  const marcada = p.bomba >= 0 ? p.cels[p.bomba] : null;
  const giradas = p.cels.map(([x, y]) => /** @type {import('./formas.js').Celula} */ ([-y, x]));
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of giradas) { if (x < mx) mx = x; if (y < my) my = y; }
  const alvo = marcada ? [-marcada[1] - mx, marcada[0] - my] : null;
  p.cels = normalizar(giradas);
  if (alvo) p.bomba = p.cels.findIndex(([x, y]) => x === alvo[0] && y === alvo[1]);
}

/**
 * @param {any} E estado da partida (partida.js)
 * @param {Set<number>} usadas cores ja na bandeja
 * @returns {Peca}
 */
function novaPeca(E, usadas) {
  const R = E.regras;
  const { forma, cels } = sortearForma(E.rng, !!R.girar);
  let cor = 1 + Math.floor(E.rng() * R.cores);
  // cores diferentes na mesma bandeja (variedade); nos sabores repetir e permitido (linha pura)
  if (!R.sabores) for (let k = 0; k < R.cores && usadas.has(cor); k++) cor = (cor % R.cores) + 1;
  usadas.add(cor);
  E.pecasGeradas++;
  let bomba = -1;
  if (R.bombas && E.pecasGeradas % BOMBA_CADA === 0) bomba = Math.floor(E.rng() * cels.length);
  return { id: E.proximoId++, forma, cels, cor, bomba, contador: bomba >= 0 ? BOMBA_CONTADOR : 0 };
}

/**
 * Enche a bandeja com 3 pecas novas.
 * @param {any} E
 */
export function sortearBandeja(E) {
  const giro = !!E.regras.girar;
  /** @type {Peca[]} */
  let pecas = [];
  for (let tent = 0; tent < TENTATIVAS; tent++) {
    const geradasAntes = E.pecasGeradas;
    const usadas = new Set();
    pecas = [novaPeca(E, usadas), novaPeca(E, usadas), novaPeca(E, usadas)];
    if (pecas.some((p) => pecaCabe(E.t, p.cels, giro))) break;
    // a bomba segue o ritmo das pecas que chegam a mesa, nao das tentativas descartadas
    if (tent < TENTATIVAS - 1) E.pecasGeradas = geradasAntes;
  }
  if (!pecas.some((p) => pecaCabe(E.t, p.cels, giro))) {
    // troca a primeira pela maior forma que cabe (se alguma cabe)
    const candidatas = [];
    for (const f of FORMAS) {
      for (const cels of ORIENTACOES[f.id]) if (temLugar(E.t, cels)) candidatas.push({ forma: f.id, cels });
    }
    if (candidatas.length) {
      candidatas.sort((a, b) => b.cels.length - a.cels.length);
      const maior = candidatas[0].cels.length;
      const grandes = candidatas.filter((c) => c.cels.length === maior);
      const c = grandes[Math.floor(E.rng() * grandes.length)];
      pecas[0] = { ...pecas[0], forma: c.forma, cels: c.cels, bomba: -1, contador: 0 };
    }
  }
  E.bandeja = pecas;
}

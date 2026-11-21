// Bot guloso: avalia cada peca da bandeja (e cada giro, na mecanica girar) em cada lugar e fica com a
// melhor nota. Serve para o modo &auto do prototipo, para os GIFs e para a medicao dos modelos.
// O ruido (com o rng passado) imita um jogador medio: com ruido 0 ele joga o melhor que sabe.
//
// Modulo puro.

import { girar90 } from './formas.js';
import { ENTULHO, VAZIO, cabe, celulasDasUnidades, totalUnidades, unidadesCheias } from './tabuleiro.js';
import { pecaCabe } from './sorteio.js';
import { colocar, girar, usarFeitico } from './partida.js';

/**
 * @typedef {object} Jogada
 * @property {'colocar'|'feitico'} tipo
 * @property {number} slot
 * @property {number} gx
 * @property {number} gy
 * @property {number} giros quantos toques de girar antes (mecanica girar)
 * @property {number} nota
 */

/**
 * Nota do tabuleiro depois da jogada: menos buracos isolados e menos bordas entre cheio e vazio.
 * @param {Int8Array} cor
 * @param {number} n
 */
function forma(cor, n) {
  let bordas = 0;
  let buracos = 0;
  let vazias = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const cheio = cor[i] !== VAZIO;
      if (!cheio) vazias++;
      if (x + 1 < n && cheio !== (cor[i + 1] !== VAZIO)) bordas++;
      if (y + 1 < n && cheio !== (cor[i + n] !== VAZIO)) bordas++;
      if (!cheio) {
        let viz = 0;
        if (x > 0 && cor[i - 1] === VAZIO) viz++;
        if (x + 1 < n && cor[i + 1] === VAZIO) viz++;
        if (y > 0 && cor[i - n] === VAZIO) viz++;
        if (y + 1 < n && cor[i + n] === VAZIO) viz++;
        if (viz === 0) buracos++;
      }
    }
  }
  return vazias * 2 - bordas * 3 - buracos * 14;
}

/**
 * Simula colocar e limpar num array de cores copiado e da a nota.
 * @param {import('./partida.js').Partida} E
 * @param {import('./formas.js').Celula[]} cels
 * @param {number} cor
 * @param {number} gx
 * @param {number} gy
 * @param {number} slot
 */
function avaliar(E, cels, cor, gx, gy, slot) {
  const n = E.n;
  const t = E.t;
  const c = t.cor.slice();
  for (const [cx, cy] of cels) c[(gy + cy) * n + gx + cx] = cor;
  const u = unidadesCheias(c, n, !!E.regras.quadrantes);
  const k = totalUnidades(u);
  let nota = 0;
  if (k) {
    nota += 140 * k * k;
    for (const g of celulasDasUnidades(u, n)) {
      const c0 = c[g.cels[0]];
      if (E.regras.sabores && c0 > 0 && g.cels.every((i) => c[i] === c0)) nota += 300;
      for (const i of g.cels) {
        if (t.bomba[i] > 0) nota += 80 + (8 - t.bomba[i]) * 25;
        if (t.estrela[i]) nota += 110;
        if (t.cor[i] === ENTULHO) nota += 10;
      }
    }
    for (const g of celulasDasUnidades(u, n)) for (const i of g.cels) c[i] = VAZIO;
  }
  // sabores: vizinho do mesmo sabor ajuda a fechar linha pura
  if (E.regras.sabores) {
    for (const [cx, cy] of cels) {
      const x = gx + cx;
      const y = gy + cy;
      if (x > 0 && t.cor[y * n + x - 1] === cor) nota += 6;
      if (x + 1 < n && t.cor[y * n + x + 1] === cor) nota += 6;
    }
  }
  // bomba perto de zerar sem ser limpa: ruim
  if (E.regras.bombas) {
    for (let i = 0; i < t.bomba.length; i++) if (t.bomba[i] === 1 && c[i] !== VAZIO) nota -= 260;
  }
  nota += forma(c, n);
  // as outras pecas da bandeja ainda cabem?
  const tmp = { n, cor: c, bomba: t.bomba, estrela: t.estrela };
  E.bandeja.forEach((p, s) => {
    if (!p || s === slot) return;
    nota += pecaCabe(tmp, p.cels, !!E.regras.girar) ? 25 : -400;
  });
  return nota;
}

/**
 * A melhor jogada (ou null se nada cabe e nao ha Feitico).
 * @param {import('./partida.js').Partida} E
 * @param {{ rng?: () => number, ruido?: number }} [op]
 * @returns {Jogada | null}
 */
export function escolherJogada(E, { rng, ruido = 0 } = {}) {
  const n = E.n;
  /** @type {Jogada|null} */
  let melhor = null;
  const sorte = () => (rng && ruido ? (rng() - 0.5) * 2 * ruido : 0);
  E.bandeja.forEach((p, slot) => {
    if (!p) return;
    let cels = p.cels;
    const voltas = E.regras.girar ? 4 : 1;
    for (let giros = 0; giros < voltas; giros++) {
      for (let gy = 0; gy < n; gy++) {
        for (let gx = 0; gx < n; gx++) {
          if (!cabe(E.t, cels, gx, gy)) continue;
          const nota = avaliar(E, cels, p.cor, gx, gy, slot) + sorte() - giros * 4;
          if (!melhor || nota > melhor.nota) melhor = { tipo: 'colocar', slot, gx, gy, giros, nota };
        }
      }
      cels = girar90(cels);
    }
  });
  if (E.feitico) {
    // usa o Feitico quando nada cabe ou quando ele remove muito
    let alvo = null;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        let tira = 0;
        for (let k = 0; k < n; k++) {
          if (E.t.cor[gy * n + k] !== VAZIO) tira++;
          if (k !== gy && E.t.cor[k * n + gx] !== VAZIO) tira++;
        }
        if (!alvo || tira > alvo.tira) alvo = { gx, gy, tira };
      }
    }
    if (alvo && (!melhor || alvo.tira >= Math.floor(n * 1.4) || (melhor.nota < -150 && alvo.tira >= n))) {
      return { tipo: 'feitico', slot: -1, gx: alvo.gx, gy: alvo.gy, giros: 0, nota: alvo.tira * 30 };
    }
  }
  return melhor;
}

/**
 * Executa a jogada do bot (gira o que precisar, depois coloca ou usa o Feitico).
 * @param {import('./partida.js').Partida} E
 * @param {Jogada} j
 * @returns {any[] | null} eventos (null se a jogada nao valeu)
 */
export function aplicarJogada(E, j) {
  if (j.tipo === 'feitico') return usarFeitico(E, j.gx, j.gy);
  const ev = [];
  for (let k = 0; k < j.giros; k++) ev.push(...(girar(E, j.slot) || []));
  const r = colocar(E, j.slot, j.gx, j.gy);
  return r ? [...ev, ...r] : null;
}

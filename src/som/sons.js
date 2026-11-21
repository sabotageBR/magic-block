// Sons do jogo, todos sintetizados (tom e sopro de receitas.js), parametrizados pelo timbre do tema.
// Regra da casa (2048-cards): o que repete a cada jogada fica baixo e sem melodia; a limpeza sobe
// numa escala pentatonica conforme a sequencia; nada de fanfarra, onda quadrada ou serrote.
// Contrato de cada receita: (v, t0, p) => duracao em s, sem sorteio.

import { tom, sopro, hz } from './receitas.js';

/** Pentatonica maior em semitons. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

/**
 * @typedef {object} Timbre
 * @property {number} raiz nota MIDI da escala
 * @property {OscillatorType} [onda] 'sine' | 'triangle'
 * @property {number} [brilho] corte do filtro passa-baixa, Hz
 * @property {number} [queda] queda das notas, s
 * @property {number} [harmonico] razao do 2o parcial (sino: 2,76; madeira: 3,9; 0 = sem)
 * @property {number} [volHarm]
 * @property {number} [ruido] centro do ruido do pouso, Hz
 * @property {number} [volRuido]
 * @property {number} [pousoHz] tom grave do pouso, Hz
 * @property {number} [glide] glide do pouso (1 = sem; > 1 sobe, bolha)
 */

/** @param {Timbre} tb */
export function criarSons(tb) {
  const onda = tb.onda || 'sine';
  const brilho = tb.brilho || 3200;
  const queda = tb.queda || 0.35;
  const harm = tb.harmonico ?? 2.76;
  const volHarm = tb.volHarm ?? 0.25;

  /** Uma nota do timbre. */
  function nota(v, t, m, vol, q = queda) {
    const f = hz(m);
    tom(v, t, { f, tipo: onda, vol, ataque: 0.004, queda: q, filtro: { f: brilho, q: 0.6 } });
    if (harm) tom(v, t, { f: f * harm, tipo: 'sine', vol: vol * volHarm, ataque: 0.002, queda: q * 0.45 });
    return t + q + 0.01;
  }
  const grau = (k) => tb.raiz + PENTA[Math.max(0, Math.min(PENTA.length - 1, k))];

  return Object.freeze({
    /** pegou a peca */
    pegar(v, t) {
      return tom(v, t, { f: hz(tb.raiz + 24), f2: hz(tb.raiz + 26), glide: 0.04, tipo: 'sine', vol: 0.035, ataque: 0.002, queda: 0.05 }) - t;
    },
    /** peca pousou (p.n = casas) */
    colocar(v, t, p = {}) {
      const n = p.n || 3;
      const f = (tb.pousoHz || 180) * (1 + (5 - Math.min(5, n)) * 0.06);
      const g = tb.glide || 0.7;
      sopro(v, t, { f: tb.ruido || 1600, q: 1.2, vol: tb.volRuido ?? 0.08, ataque: 0.001, queda: 0.05 });
      return tom(v, t, { f, f2: f * g, glide: 0.08, tipo: 'sine', vol: 0.12, ataque: 0.003, queda: 0.12 }) - t;
    },
    /** limpeza (p.k unidades, p.seq sequencia) */
    limpar(v, t, p = {}) {
      const k = p.k || 1;
      const seq = Math.max(1, p.seq || 1);
      const base = grau(seq - 1);
      let fim = nota(v, t, base, 0.1);
      if (k >= 2) fim = Math.max(fim, nota(v, t + 0.045, base + 7, 0.07));
      if (k >= 3) fim = Math.max(fim, nota(v, t + 0.09, base + 12, 0.06));
      sopro(v, t, { f: 5000, f2: 1800, glide: 0.25, q: 0.8, vol: 0.035 + k * 0.01, ataque: 0.01, queda: 0.25 });
      return fim - t;
    },
    /** sequencia subiu (p.seq) */
    combo(v, t, p = {}) {
      const m = grau(Math.min(8, (p.seq || 2) + 2)) + 12;
      return nota(v, t + 0.08, m, 0.05, 0.25) - t;
    },
    recusa(v, t) {
      tom(v, t, { f: 170, tipo: 'triangle', vol: 0.07, ataque: 0.003, queda: 0.06, filtro: { f: 900 } });
      return tom(v, t + 0.08, { f: 140, tipo: 'triangle', vol: 0.07, ataque: 0.003, queda: 0.09, filtro: { f: 900 } }) - t;
    },
    fim(v, t) {
      nota(v, t, tb.raiz + 7, 0.08, 0.3);
      nota(v, t + 0.18, tb.raiz + 4, 0.08, 0.3);
      return nota(v, t + 0.36, tb.raiz, 0.09, 0.7) - t;
    },
    girar(v, t) {
      return tom(v, t, { f: hz(tb.raiz + 19), f2: hz(tb.raiz + 24), glide: 0.06, tipo: 'sine', vol: 0.05, ataque: 0.002, queda: 0.07 }) - t;
    },
    /** o orbe encheu */
    feitico(v, t) {
      let fim = t;
      [0, 4, 7].forEach((g, i) => { fim = nota(v, t + i * 0.07, tb.raiz + 12 + g, 0.06, 0.5); });
      sopro(v, t, { f: 6000, q: 2, vol: 0.03, ataque: 0.2, queda: 0.4 });
      return fim - t;
    },
    /** Feitico usado */
    magia(v, t) {
      sopro(v, t, { f: 400, f2: 5000, glide: 0.3, q: 1.5, vol: 0.09, ataque: 0.02, queda: 0.4 });
      nota(v, t + 0.05, tb.raiz, 0.09, 0.6);
      return nota(v, t + 0.05, tb.raiz + 7, 0.07, 0.6) - t;
    },
    /** contador de bomba baixo */
    tique(v, t) {
      return tom(v, t, { f: 1800, tipo: 'sine', vol: 0.05, ataque: 0.001, queda: 0.03 }) - t;
    },
    explodiu(v, t) {
      sopro(v, t, { f: 900, f2: 120, glide: 0.4, q: 0.7, filtro: 'lowpass', vol: 0.25, ataque: 0.003, queda: 0.5 });
      return tom(v, t, { f: 90, f2: 40, glide: 0.4, tipo: 'sine', vol: 0.2, ataque: 0.003, queda: 0.45 }) - t;
    },
    estrela(v, t) {
      return nota(v, t, tb.raiz + 28, 0.035, 0.4) - t;
    },
    coletou(v, t) {
      nota(v, t, tb.raiz + 24, 0.06, 0.35);
      return nota(v, t + 0.09, tb.raiz + 31, 0.06, 0.5) - t;
    },
  });
}

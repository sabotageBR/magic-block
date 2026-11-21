// Sons do Magic Block (tema Galaxia), todos sintetizados: sinos FM (o timbre de cristal), brilhos
// agudos espalhados no estereo, varridas de ruido, impacto grave e acordes de pad. Tudo na
// pentatonica de Mi maior, a mesma da musica (src/som/musica.js), e passa pelo reverb do audio.js.
//
// O que repete a cada jogada (pegar, girar, pousar) fica curto e baixo. A recompensa cresce em
// camadas: 1 linha = acorde de sino + brilho; 2 linhas = + impacto e arpejo; 3 ou mais = supernova
// (pad que abre, arpejo longo, sino final); a sequencia (combo) sobe a escala a cada passo e ganha
// subida e impacto nos passos altos; tabuleiro limpo = cadencia de dois acordes.
// Contrato de cada receita: (v, t0, p) => duracao em s, sem sorteio.

import { tom, sopro, hz } from './receitas.js';

const MIN = 0.0001;
const PENTA = [0, 2, 4, 7, 9];
/** Grau k da pentatonica de Mi (k = 0 e Mi4; 5 e Mi5...). */
export const grau = (k) => 64 + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5];

/** Envelope sem clique. @param {AudioParam} g */
function envelope(g, t, pico, ataque, queda) {
  g.setValueAtTime(MIN, t);
  g.exponentialRampToValueAtTime(Math.max(MIN * 2, pico), t + Math.max(0.001, ataque));
  g.exponentialRampToValueAtTime(MIN, t + ataque + Math.max(0.01, queda));
  return t + ataque + queda;
}

/** A mesma via com um ganho a mais (os sons de recompensa ficam acima dos de jogada). */
function reforco(v, k) {
  try {
    const g = v.ctx.createGain();
    g.gain.value = k;
    g.connect(v.destino);
    return { ...v, destino: g };
  } catch {
    return v;
  }
}

/** Saida com pan estereo (se o navegador tiver). */
function saida(v, pan) {
  if (!pan) return v.destino;
  try {
    const p = v.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(v.destino);
    return p;
  } catch {
    return v.destino;
  }
}

/**
 * Sino FM: portadora senoidal modulada por outra (razao inarmonica = cristal); o indice cai junto
 * com o volume (o ataque brilha, a cauda fica pura).
 * @param {any} v
 * @param {number} t
 * @param {{ f: number, razao?: number, indice?: number, vol?: number, ataque?: number, queda?: number, pan?: number }} o
 */
function fm(v, t, o) {
  const { ctx } = v;
  const f = o.f;
  const queda = o.queda ?? 0.9;
  const ataque = o.ataque ?? 0.004;
  const car = ctx.createOscillator();
  car.frequency.setValueAtTime(f, t);
  const mod = ctx.createOscillator();
  mod.frequency.setValueAtTime(f * (o.razao ?? 3.5), t);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * (o.indice ?? 2), t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + ataque + queda * 0.6);
  mod.connect(mg);
  mg.connect(car.frequency);
  const g = ctx.createGain();
  const fim = envelope(g.gain, t, o.vol ?? 0.06, ataque, queda);
  car.connect(g);
  g.connect(saida(v, o.pan));
  car.start(t);
  mod.start(t);
  car.stop(fim + 0.05);
  mod.stop(fim + 0.05);
  return fim;
}

/** Sino de cristal na nota MIDI m (FM + oitava senoidal baixinha). */
function sino(v, t, m, vol = 0.06, queda = 0.9, pan = 0) {
  const f = hz(m);
  const fim = fm(v, t, { f, razao: 3.5, indice: 2.2, vol, queda, pan });
  tom(v, t, { f: f * 2, tipo: 'sine', vol: vol * 0.25, ataque: 0.002, queda: queda * 0.4 });
  return fim;
}

/** Brilhos agudos espalhados no estereo (n pings rapidos). */
function brilho(v, t, vol = 0.03, n = 5, base = 22) {
  let fim = t;
  for (let i = 0; i < n; i++) {
    const m = grau(base + ((i * 3) % 7));
    fim = Math.max(fim, fm(v, t + i * 0.034, { f: hz(m), razao: 2.01, indice: 0.8, vol: vol * (1 - i / (n * 1.6)), queda: 0.16, pan: i % 2 ? 0.55 : -0.55 }));
  }
  return fim;
}

/** Varrida de ruido (vento estelar). */
function varrida(v, t, dur, f1, f2, vol, filtro = 'bandpass') {
  return sopro(v, t, { f: f1, f2, glide: dur, q: 1.2, filtro, vol, ataque: dur * 0.3, queda: dur * 0.7 });
}

/** Impacto grave (a limpeza grande "pesa"). */
function impacto(v, t, vol = 0.2) {
  sopro(v, t, { f: 700, f2: 90, glide: 0.3, q: 0.7, filtro: 'lowpass', vol: vol * 0.5, ataque: 0.002, queda: 0.35 });
  return tom(v, t, { f: 120, f2: 38, glide: 0.35, tipo: 'sine', vol, ataque: 0.003, queda: 0.42 });
}

/** Pad que abre (acorde de triangulos levemente desafinados, filtro subindo). */
function pad(v, t, notas, vol = 0.035, dur = 1.4) {
  let fim = t;
  notas.forEach((m, i) => {
    for (const d of [-0.004, 0.004]) {
      fim = Math.max(fim, tom(v, t, {
        f: hz(m) * (1 + d), tipo: 'triangle', vol, ataque: 0.08 + i * 0.02, queda: dur,
        filtro: { f: 500, f2: 4200, glide: dur * 0.5, q: 0.7 },
      }));
    }
  });
  return fim;
}

/** Arpejo de sinos subindo pelos graus. */
function arpejo(v, t, de, n, passo = 0.05, vol = 0.045, queda = 0.5) {
  let fim = t;
  for (let i = 0; i < n; i++) fim = Math.max(fim, sino(v, t + i * passo, grau(de + i), vol * (1 - i / (n * 2.2)), queda, (i % 3 - 1) * 0.4));
  return fim;
}

/** @type {Readonly<Record<string, (v: any, t: number, p?: any) => number>>} */
export const SONS = Object.freeze({
  /** pegou a peca */
  pegar(v, t) {
    return tom(v, t, { f: 1150, f2: 1600, glide: 0.035, tipo: 'sine', vol: 0.07, ataque: 0.002, queda: 0.07 }) - t;
  },
  /** girou a peca (p.giro) */
  girar(v, t, p = {}) {
    varrida(v, t, 0.12, 700, 3800, 0.05);
    return sino(v, t + 0.02, grau(12 + ((p.giro || 0) % 4)), 0.03, 0.3, 0.2) - t;
  },
  /** peca pousou (p.n = casas) */
  colocar(v, t, p = {}) {
    const n = Math.min(9, p.n || 3);
    const f = 210 - n * 9;
    tom(v, t, { f, f2: f * 0.6, glide: 0.08, tipo: 'sine', vol: 0.16, ataque: 0.002, queda: 0.13 });
    fm(v, t, { f: 1250 + n * 40, razao: 1.41, indice: 3, vol: 0.028, queda: 0.06 });
    return sopro(v, t, { f: 1400, q: 0.8, filtro: 'lowpass', vol: 0.04, ataque: 0.001, queda: 0.05 }) - t;
  },
  recusa(v, t) {
    tom(v, t, { f: 196, tipo: 'triangle', vol: 0.06, ataque: 0.003, queda: 0.07, filtro: { f: 900 } });
    return tom(v, t + 0.085, { f: 165, tipo: 'triangle', vol: 0.06, ataque: 0.003, queda: 0.11, filtro: { f: 900 } }) - t;
  },
  /**
   * Limpeza: p.k unidades juntas, p.seq sequencia, p.dobro (x2 da estrela).
   * 1 = acorde + brilho; 2 = + impacto e arpejo; 3+ = supernova.
   */
  limpar(v, t, p = {}) {
    v = reforco(v, 1.9);
    const k = Math.max(1, p.k || 1);
    const seq = Math.max(1, p.seq || 1);
    const b = 5 + Math.min(seq - 1, 9);
    let fim = t;
    varrida(v, t, 0.38, 2200, 9500, 0.04 + k * 0.012, 'highpass');
    [0, 2, 4].forEach((d, i) => { fim = Math.max(fim, sino(v, t + i * 0.025, grau(b + d), 0.07, 1.0, (i - 1) * 0.35)); });
    fim = Math.max(fim, brilho(v, t + 0.06, 0.028, 4 + k));
    if (k >= 2) {
      impacto(v, t, 0.14 + Math.min(3, k) * 0.03);
      fim = Math.max(fim, sino(v, t + 0.05, grau(b + 5), 0.06, 1.2));
      fim = Math.max(fim, arpejo(v, t + 0.1, b + 5, 3 + k, 0.045, 0.045));
    }
    if (k >= 3) {
      fim = Math.max(fim, pad(v, t + 0.02, [grau(b - 5), grau(b - 3), grau(b - 1), grau(b + 2)], 0.03, 1.6));
      fim = Math.max(fim, arpejo(v, t + 0.32, b + 7, 6, 0.04, 0.035, 0.7));
      fim = Math.max(fim, sino(v, t + 0.62, grau(b + 12), 0.05, 1.8));
      varrida(v, t, 0.9, 300, 6000, 0.05);
    }
    if (p.dobro) {
      fim = Math.max(fim, brilho(v, t + 0.15, 0.03, 6, 26));
      fim = Math.max(fim, sino(v, t + 0.2, grau(b + 10), 0.035, 1.2));
    }
    return fim - t;
  },
  /** a sequencia subiu (p.seq): escada que sobe a escala; nos passos altos, subida e impacto */
  combo(v, t, p = {}) {
    v = reforco(v, 1.7);
    const seq = Math.max(2, p.seq || 2);
    const b = 7 + Math.min(seq, 12);
    const t0 = t + 0.14;
    let fim = t0;
    [0, 1, 2].forEach((d, i) => { fim = Math.max(fim, sino(v, t0 + i * 0.06, grau(b + d), 0.05 + Math.min(seq, 8) * 0.004, 0.35, (i - 1) * 0.5)); });
    fim = Math.max(fim, sino(v, t0 + 0.2, grau(b + 4), 0.06, 1.0));
    if (seq >= 4) varrida(v, t, 0.3, 500, 7000, 0.05);
    if (seq >= 6) {
      impacto(v, t0 + 0.2, 0.15);
      fim = Math.max(fim, pad(v, t0 + 0.2, [grau(b - 5), grau(b - 3), grau(b - 1)], 0.025, 1.2));
    }
    if (seq >= 8) fim = Math.max(fim, brilho(v, t0 + 0.3, 0.035, 8, 27));
    return fim - t;
  },
  /** tabuleiro limpo: cadencia de dois acordes, arpejo e brilho */
  perfeito(v, t) {
    v = reforco(v, 1.7);
    let fim = t;
    impacto(v, t, 0.2);
    fim = Math.max(fim, pad(v, t, [grau(0), grau(2), grau(4), grau(7)], 0.03, 1.2));
    [5, 7, 9].forEach((g, i) => { fim = Math.max(fim, sino(v, t + i * 0.03, grau(g), 0.06, 0.9)); });
    fim = Math.max(fim, pad(v, t + 0.45, [grau(3), grau(5), grau(8), grau(10)], 0.032, 2.0));
    [10, 12, 14, 15].forEach((g, i) => { fim = Math.max(fim, sino(v, t + 0.45 + i * 0.03, grau(g), 0.06, 1.8)); });
    fim = Math.max(fim, arpejo(v, t + 0.6, 12, 10, 0.045, 0.04, 0.8));
    varrida(v, t + 0.4, 1.0, 400, 9000, 0.06);
    return fim - t;
  },
  /** estrela avisada (o circulo tracejado) */
  aviso(v, t) {
    sino(v, t, grau(18), 0.022, 0.35, -0.4);
    return sino(v, t + 0.09, grau(20), 0.02, 0.45, 0.4) - t;
  },
  /** a estrela caiu na casa */
  estrela(v, t) {
    tom(v, t, { f: 2600, f2: 700, glide: 0.3, tipo: 'sine', vol: 0.035, ataque: 0.004, queda: 0.32 });
    return sino(v, t + 0.3, grau(17), 0.04, 0.6) - t;
  },
  /** estrela coletada: o x2 ligou */
  coletou(v, t) {
    v = reforco(v, 1.4);
    const fim = arpejo(v, t, 10, 5, 0.05, 0.05, 0.6);
    return Math.max(fim, brilho(v, t + 0.25, 0.03, 6, 25)) - t;
  },
  /** fim de jogo: sinos descendo sobre um pad grave */
  fim(v, t) {
    v = reforco(v, 1.3);
    let fim = pad(v, t, [grau(-5), grau(-3), grau(-1)], 0.025, 2.2);
    [9, 7, 5, 2].forEach((g, i) => { fim = Math.max(fim, sino(v, t + i * 0.22, grau(g), 0.055, 1.1)); });
    return fim - t;
  },
  /** recorde batido */
  recorde(v, t) {
    v = reforco(v, 1.5);
    let fim = t;
    [10, 12, 14].forEach((g, i) => { fim = Math.max(fim, sino(v, t + i * 0.02, grau(g), 0.06, 1.4)); });
    fim = Math.max(fim, arpejo(v, t + 0.2, 15, 6, 0.05, 0.04, 0.8));
    return Math.max(fim, brilho(v, t + 0.5, 0.03, 8, 27)) - t;
  },
  /** reviveu (premio do video) */
  reviver(v, t) {
    v = reforco(v, 1.4);
    varrida(v, t, 0.6, 200, 5000, 0.07);
    tom(v, t, { f: 220, f2: 880, glide: 0.55, tipo: 'sine', vol: 0.05, ataque: 0.05, queda: 0.55 });
    let fim = t + 0.6;
    [5, 7, 9].forEach((g, i) => { fim = Math.max(fim, sino(v, t + 0.55 + i * 0.03, grau(g), 0.06, 1.2)); });
    return fim - t;
  },
  /** bandeja nova */
  bandeja(v, t) {
    let fim = t;
    [15, 17, 19].forEach((g, i) => { fim = Math.max(fim, sino(v, t + i * 0.045, grau(g), 0.014, 0.25, (i - 1) * 0.5)); });
    return fim - t;
  },
  /** botao do menu */
  botao(v, t) {
    tom(v, t, { f: 900, tipo: 'sine', vol: 0.04, ataque: 0.002, queda: 0.04 });
    return tom(v, t + 0.03, { f: 1350, tipo: 'sine', vol: 0.03, ataque: 0.002, queda: 0.06 }) - t;
  },
});

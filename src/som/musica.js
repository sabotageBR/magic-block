// Musica ambiente generativa (sem arquivo de audio): pad lento de quatro acordes em Mi maior, um baixo
// longo e sinos esparsos da pentatonica, tudo pelo barramento de musica do audio.js (que manda para o
// reverb). Baixinha de proposito: fica atras dos efeitos. O agendador olha 1 s a frente no relogio do
// AudioContext e so agenda quando o audio pode tocar musica (destravado, fora de anuncio, aba visivel,
// botao Musica ligado).

import { hz } from './receitas.js';

const MIN = 0.0001;
/** Acordes (MIDI): Mi maj9, Do# m7, La maj7, Si 6/9 */
const ACORDES = [
  [52, 59, 63, 66, 71],
  [49, 56, 59, 64, 68],
  [45, 52, 56, 59, 64],
  [47, 54, 59, 61, 66],
];
const DUR = 8;
const SINOS = [76, 78, 80, 83, 85, 88, 90];

/**
 * @param {ReturnType<typeof import('../core/audio.js').criarAudio>} audio
 * @param {{ agendar?: (fn: () => void, ms: number) => any, cancelar?: (id: any) => void }} [op]
 */
export function criarMusica(audio, op = {}) {
  const agendar = op.agendar || ((fn, ms) => setInterval(fn, ms));
  const cancelar = op.cancelar || ((id) => clearInterval(id));
  let timer = null;
  let proximo = 0;
  let acorde = 0;
  let proxSino = 0;
  let s = 7;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };

  /** uma voz com ataque e soltura longos */
  function voz(ctx, destino, f, t, dur, vol, tipo, corte) {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(corte, t);
    fl.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(MIN, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 2.4);
    g.gain.setValueAtTime(vol, t + dur);
    g.gain.exponentialRampToValueAtTime(MIN, t + dur + 2.6);
    o.connect(fl);
    fl.connect(g);
    g.connect(destino);
    o.start(t);
    o.stop(t + dur + 2.7);
  }

  function tocarAcorde(t, notas) {
    const ctx = audio.ctx;
    const dest = audio.barramentoMusica;
    for (const m of notas.slice(1)) {
      voz(ctx, dest, hz(m) * 0.9977, t, DUR, 0.012, 'triangle', 900);
      voz(ctx, dest, hz(m) * 1.0023, t, DUR, 0.012, 'sine', 1400);
    }
    voz(ctx, dest, hz(notas[0] - 12), t, DUR, 0.04, 'sine', 400);
  }

  function tocarSino(t) {
    const ctx = audio.ctx;
    const f = hz(SINOS[Math.floor(r() * SINOS.length)]);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    const p = ctx.createOscillator();
    p.frequency.setValueAtTime(f * 2.76, t);
    const g = ctx.createGain();
    const gp = ctx.createGain();
    const vol = 0.01 + r() * 0.012;
    g.gain.setValueAtTime(MIN, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(MIN, t + 2.2);
    gp.gain.setValueAtTime(MIN, t);
    gp.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.005);
    gp.gain.exponentialRampToValueAtTime(MIN, t + 0.6);
    o.connect(g);
    p.connect(gp);
    g.connect(audio.barramentoMusica);
    gp.connect(audio.barramentoMusica);
    o.start(t);
    p.start(t);
    o.stop(t + 2.3);
    p.stop(t + 0.7);
  }

  function passo() {
    if (!audio.podeTocarMusica()) {
      proximo = 0;
      proxSino = 0;
      return;
    }
    const agora = audio.ctx.currentTime;
    if (proximo < agora) proximo = agora + 0.1;
    if (proxSino < agora) proxSino = agora + 1.5;
    try {
      while (proximo < agora + 1) {
        tocarAcorde(proximo, ACORDES[acorde % ACORDES.length]);
        acorde++;
        proximo += DUR;
      }
      while (proxSino < agora + 1) {
        tocarSino(proxSino);
        proxSino += 1.4 + r() * 2.6;
      }
    } catch { /* contexto fechando */ }
  }

  return {
    iniciar() {
      if (timer === null) timer = agendar(passo, 250);
    },
    parar() {
      if (timer !== null) cancelar(timer);
      timer = null;
    },
    /** para os testes */
    passo,
  };
}

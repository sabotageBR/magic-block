// Tema 3 - Doceria: fundo rosa de bolinhas, bandeja de confeitaria com borda ondulada, gelatinas
// translucidas que amassam ao cair, confete e granulado na limpeza.
// Mecanica padrao: linha de um sabor so (x3). Os 4 primeiros sabores: morango, limao, menta, uva.

import { TAU, alfa, arredondado, clarear, escurecer } from '../../src/render/desenho.js';
import { areaGrupo, h } from './util.js';

const COR = ['#ff6f91', '#ffcf3f', '#3fd2a2', '#9b7bff', '#ff9a4d', '#5ab0ff'];
const GRANULADO = ['#ff6f91', '#ffcf3f', '#3fd2a2', '#9b7bff', '#ffffff', '#5ab0ff'];

export default {
  id: 'doceria',
  nome: 'Doceria',
  mec: 3,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#8a6f63',
  hud: { texto: '#ffffff', suave: '#ffffff', contorno: '#d9507a', destaque: '#ffffff', combo: '#ffffff', coroa: '#ffcf3f' },
  painel: { fundo: '#fff6ec', borda: '#ff8fb1', texto: '#c2456a', botao: '#ff6f91' },
  folga: 0.2,
  pouso: 0.26,
  saida: 'cresce',
  timbre: { raiz: 67, onda: 'sine', harmonico: 2, volHarm: 0.15, queda: 0.22, brilho: 3000, ruido: 2500, volRuido: 0.04, pousoHz: 260, glide: 1.6 },

  /** @param {CanvasRenderingContext2D} ctx */
  fundo(ctx, L) {
    const { W, H } = L;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffc7da');
    g.addColorStop(1, '#ffb0ca');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const p = 34;
    for (let y = 0; y < H + p; y += p) {
      for (let x = (y / p) % 2 ? p / 2 : 0; x < W + p; x += p) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
      }
    }
  },

  /** granulado caindo devagar @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    for (let i = 0; i < 14; i++) {
      const vel = 18 + h(i, 2) * 16;
      const y = ((t * vel + h(i, 3) * (L.H + 40)) % (L.H + 40)) - 20;
      const x = h(i, 1) * L.W;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(h(i, 4) * TAU + t * (h(i, 5) - 0.5));
      ctx.fillStyle = alfa(GRANULADO[i % GRANULADO.length], 0.7);
      arredondado(ctx, -5, -1.6, 10, 3.2, 1.6);
      ctx.fill();
      ctx.restore();
    }
  },

  /** bandeja creme com borda ondulada @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L) {
    const { tab, cs, n } = L;
    const pad = cs * 0.3;
    const x0 = tab.x - pad;
    const y0 = tab.y - pad;
    const w = tab.w + pad * 2;
    const hh = tab.h + pad * 2;
    // borda ondulada (bolinhas em volta)
    ctx.fillStyle = '#ff8fb1';
    const r = pad * 0.55;
    const passo = r * 1.6;
    for (let x = x0 + r; x <= x0 + w - r + 0.1; x += passo) {
      ctx.beginPath(); ctx.arc(x, y0 + r * 0.6, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y0 + hh - r * 0.6, r, 0, TAU); ctx.fill();
    }
    for (let y = y0 + r; y <= y0 + hh - r + 0.1; y += passo) {
      ctx.beginPath(); ctx.arc(x0 + r * 0.6, y, r, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x0 + w - r * 0.6, y, r, 0, TAU); ctx.fill();
    }
    arredondado(ctx, x0 + r * 0.4, y0 + r * 0.4, w - r * 0.8, hh - r * 0.8, cs * 0.3);
    ctx.fillStyle = '#ff8fb1';
    ctx.fill();
    arredondado(ctx, tab.x - pad * 0.45, tab.y - pad * 0.45, tab.w + pad * 0.9, tab.h + pad * 0.9, cs * 0.24);
    ctx.fillStyle = '#fff6ec';
    ctx.fill();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = tab.x + x * cs;
        const py = tab.y + y * cs;
        arredondado(ctx, px + 2.5, py + 2.5, cs - 5, cs - 5, cs * 0.26);
        ctx.fillStyle = '#fbe1e9';
        ctx.fill();
        ctx.fillStyle = 'rgba(214,120,150,0.12)';
        arredondado(ctx, px + 2.5, py + 2.5, cs - 5, cs * 0.3, cs * 0.2);
        ctx.fill();
      }
    }
  },

  /** gelatina translucida com brilho @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.05;
    arredondado(ctx, m, m + s * 0.03, s - m * 2, s - m * 2, s * 0.28);
    ctx.fillStyle = escurecer(cor, 0.25);
    ctx.fill();
    arredondado(ctx, m, m, s - m * 2, s - m * 2 - s * 0.03, s * 0.28);
    const g = ctx.createRadialGradient(s * 0.5, s * 0.55, s * 0.05, s * 0.5, s * 0.5, s * 0.55);
    g.addColorStop(0, clarear(cor, 0.45));
    g.addColorStop(0.7, cor);
    g.addColorStop(1, escurecer(cor, 0.08));
    ctx.fillStyle = g;
    ctx.fill();
    // brilho grande
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(s * 0.36, s * 0.24, s * 0.2, s * 0.09, -0.35, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.7, s * 0.22, s * 0.045, 0, TAU);
    ctx.fill();
    // reflexo de baixo
    ctx.fillStyle = alfa(clarear(cor, 0.6), 0.5);
    ctx.beginPath();
    ctx.ellipse(s * 0.55, s * 0.8, s * 0.22, s * 0.05, 0, 0, TAU);
    ctx.fill();
  },

  /** biscoito queimado @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    const m = s * 0.05;
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.2);
    ctx.fillStyle = '#8a6f63';
    ctx.fill();
    ctx.fillStyle = '#6a5249';
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(s * (0.25 + h(k, 3) * 0.5), s * (0.25 + h(k, 5) * 0.5), s * 0.05, 0, TAU);
      ctx.fill();
    }
  },

  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, [c.cor, clarear(c.cor, 0.5)], 5, { forma: 'c', tam: c.s * 0.2, forca: 0.8, g: 520, vida: 0.6 });
    fx.estourar(cx, cy, GRANULADO, 5, { forma: 'confete', tam: c.s * 0.22, forca: 1, g: 420, vida: 0.9, vr: 10 });
  },

  /** linha de um sabor so: chuva de confete na faixa toda */
  limparGrupo(fx, L, g) {
    if (!g.pura) return;
    const r = areaGrupo(L, g);
    for (let k = 0; k < 12; k++) {
      const x = r.x + (r.w * (k + 0.5)) / 12;
      const y = r.y + r.h / 2;
      fx.estourar(r.w > r.h ? x : r.x + r.w / 2, r.w > r.h ? y : r.y + (r.h * (k + 0.5)) / 12, GRANULADO, 4, { forma: 'confete', tam: L.cs * 0.26, forca: 1.6, g: 380, vida: 1.2, vr: 12 });
    }
    fx.efeito(0.5, (ctx, u) => {
      ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - u)})`;
      arredondado(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, L.cs * 0.3);
      ctx.fill();
    });
  },
};

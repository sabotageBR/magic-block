// Tema 6 - Recife: aquario com raios de luz, reflexo caustico mexendo e bolhas subindo; fundo de
// areia com corais; blocos de coral e bolha arredondados. Na limpeza tudo vira bolha.
// Mecanica padrao: girar a peca (um toque gira 90 graus).

import { TAU, alfa, arredondado, clarear, escurecer } from '../../src/render/desenho.js';
import { areaGrupo, h } from './util.js';

const COR = ['#ff7f6e', '#ffd05a', '#2fd8c8', '#b07cff', '#5fd36a', '#ff8fc7'];

/** coral em silhueta (galhos) @param {CanvasRenderingContext2D} ctx */
function coral(ctx, x, y, s, cor, k) {
  ctx.strokeStyle = cor;
  ctx.lineCap = 'round';
  const galho = (x0, y0, a, comp, larg, nivel) => {
    const x1 = x0 + Math.cos(a) * comp;
    const y1 = y0 + Math.sin(a) * comp;
    ctx.lineWidth = larg;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (nivel > 0) {
      galho(x1, y1, a - 0.45 - h(k + nivel, 2) * 0.2, comp * 0.72, larg * 0.72, nivel - 1);
      galho(x1, y1, a + 0.4 + h(k + nivel, 3) * 0.2, comp * 0.7, larg * 0.72, nivel - 1);
    }
  };
  galho(x, y, -Math.PI / 2, s * 0.4, s * 0.12, 3);
}

export default {
  id: 'recife',
  nome: 'Recife',
  mec: 6,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#7c8b8f',
  hud: { texto: '#ffffff', suave: '#d8fbff', contorno: 'rgba(4,40,70,0.8)', destaque: '#ffe27a', combo: '#ffffff', coroa: '#ffd05a' },
  painel: { fundo: '#0b4a72', borda: '#7fe9ff', texto: '#ffffff', botao: '#ff7f6e' },
  folga: 0.18,
  pouso: 0.16,
  saida: 'cresce',
  timbre: { raiz: 65, onda: 'sine', harmonico: 2, volHarm: 0.12, queda: 0.3, brilho: 2600, ruido: 1800, volRuido: 0.05, pousoHz: 240, glide: 1.8 },

  /** @param {CanvasRenderingContext2D} ctx */
  fundo(ctx, L) {
    const { W, H } = L;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4fd0e6');
    g.addColorStop(0.45, '#127aa6');
    g.addColorStop(1, '#063a63');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // raios de luz
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x = W * (0.1 + k * 0.22);
      const lg = ctx.createLinearGradient(0, 0, 0, H * 0.8);
      lg.addColorStop(0, 'rgba(255,255,255,0.14)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + W * 0.08, 0);
      ctx.lineTo(x + W * 0.2, H * 0.8);
      ctx.lineTo(x + W * 0.05, H * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // areia e corais
    const ya = H * (L.retrato ? 0.9 : 0.86);
    const corais = ['#ff7f6e', '#b07cff', '#ff8fc7', '#ffb35a'];
    for (let k = 0; k < 7; k++) coral(ctx, W * (0.04 + k * 0.16 + h(k, 1) * 0.05), ya + 6, Math.min(W, H) * (0.16 + h(k, 2) * 0.1), alfa(corais[k % 4], 0.34), k * 7);
    ctx.fillStyle = '#e8cf95';
    ctx.beginPath();
    ctx.moveTo(0, ya);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ya + Math.sin(x * 0.02) * 6);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
  },

  /** caustica e bolhas @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    const { W, H } = L;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = H * 0.04 + k * 16 + Math.sin(x * 0.03 + t * 1.4 + k) * 6 + Math.sin(x * 0.011 - t * 0.9) * 8;
        if (x) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const vel = 26 + h(i, 2) * 30;
      const y = H + 20 - ((t * vel + h(i, 3) * (H + 40)) % (H + 40));
      const x = h(i, 1) * W + Math.sin(t * 1.5 + i) * 8;
      const r = 2 + h(i, 4) * 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** poca de vidro com borda de areia @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L) {
    const { tab, cs, n } = L;
    const pad = cs * 0.26;
    arredondado(ctx, tab.x - pad, tab.y - pad, tab.w + pad * 2, tab.h + pad * 2, cs * 0.45);
    ctx.fillStyle = 'rgba(4,46,80,0.55)';
    ctx.fill();
    ctx.lineWidth = Math.max(4, cs * 0.12);
    ctx.strokeStyle = '#f2d7a0';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    arredondado(ctx, tab.x - pad + 5, tab.y - pad + 5, tab.w + pad * 2 - 10, tab.h + pad * 2 - 10, cs * 0.4);
    ctx.stroke();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        arredondado(ctx, tab.x + x * cs + 3, tab.y + y * cs + 3, cs - 6, cs - 6, cs * 0.32);
        ctx.fillStyle = 'rgba(0,30,60,0.32)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,240,255,0.14)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  },

  /** coral/bolha arredondado @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.05;
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.36);
    const g = ctx.createLinearGradient(0, m, 0, s - m);
    g.addColorStop(0, clarear(cor, 0.35));
    g.addColorStop(0.55, cor);
    g.addColorStop(1, escurecer(cor, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    // poros do coral
    ctx.fillStyle = alfa(clarear(cor, 0.5), 0.55);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(s * (0.28 + h(k, 5) * 0.46), s * (0.45 + h(k, 6) * 0.35), s * 0.04, 0, TAU);
      ctx.fill();
    }
    // reflexo de bolha
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.3, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(s * 0.7, s * 0.26, s * 0.045, 0, TAU);
    ctx.fill();
  },

  /** pedra de fundo @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    arredondado(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.3);
    ctx.fillStyle = '#7c8b8f';
    ctx.fill();
    ctx.fillStyle = 'rgba(95,211,106,0.7)';
    ctx.beginPath();
    ctx.ellipse(s * 0.4, s * 0.22, s * 0.25, s * 0.08, -0.2, 0, TAU);
    ctx.fill();
  },

  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, ['#ffffff', '#c8f6ff'], 4, { forma: 'bolha', tam: c.s * 0.3, forca: 0.5, g: -260, vida: 1, arrasto: 0.96, vr: 0 });
    fx.estourar(cx, cy, [c.cor, clarear(c.cor, 0.4)], 4, { forma: 'c', tam: c.s * 0.16, forca: 0.8, g: 200, vida: 0.6 });
  },

  /** ondinha clara pela unidade */
  limparGrupo(fx, L, g) {
    const r = areaGrupo(L, g);
    fx.efeito(0.5, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(160,240,255,${0.35 * Math.sin(u * Math.PI)})`;
      arredondado(ctx, r.x, r.y, r.w, r.h, L.cs * 0.4);
      ctx.fill();
    });
  },

  colocar(fx, cels) {
    const c = cels[0];
    if (c) fx.subir(c.x + c.s / 2, c.y, ['rgba(255,255,255,0.8)'], 2, { forma: 'bolha', tam: c.s * 0.18, vida: 0.9, forca: 1, encolhe: false });
  },
};

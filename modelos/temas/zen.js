// Tema 2 - Jardim Zen: areia rastelada, moldura de madeira, pedras de rio lisas (jade, musgo,
// ardosia, terracota), folhas caindo devagar. Na limpeza as pedras afundam na areia com ondulacao.
// Mecanica padrao: tabuleiro 9x9 com quadrantes 3x3.

import { TAU, alfa, arredondado, clarear, escurecer } from '../../src/render/desenho.js';
import { areaGrupo, h } from './util.js';

const COR = ['#5fae8c', '#93ad4f', '#6d7f99', '#cf7a58', '#e3929f', '#9a86b8'];

/** pedra decorativa com musgo @param {CanvasRenderingContext2D} ctx */
function pedra(ctx, x, y, r, k) {
  ctx.save();
  // aneis rastelados em volta
  ctx.strokeStyle = 'rgba(120,95,60,0.16)';
  ctx.lineWidth = 2;
  for (let a = 1; a <= 4; a++) {
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.1, r * (1 + a * 0.38), r * (0.7 + a * 0.3), 0, 0, TAU);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#9c968d');
  g.addColorStop(1, '#5c574f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, k * 0.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(110,150,70,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.15, y - r * 0.45, r * 0.55, r * 0.22, -0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export default {
  id: 'zen',
  nome: 'Jardim Zen',
  mec: 2,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#4b4a48',
  hud: { texto: '#4a3a28', suave: '#7a6448', contorno: 'rgba(255,248,232,0.9)', destaque: '#b9532c', combo: '#3d8a68', coroa: '#c99a2e' },
  painel: { fundo: '#f6edd8', borda: '#8d6238', texto: '#4a3a28', botao: '#5fae8c' },
  folga: 0.18,
  pouso: 0.08,
  saida: 'afunda',
  desenhaQuadrantes: true,
  timbre: { raiz: 60, onda: 'sine', harmonico: 3.9, volHarm: 0.18, queda: 0.3, brilho: 2400, ruido: 900, volRuido: 0.06, pousoHz: 150, glide: 0.75 },

  /** @param {CanvasRenderingContext2D} ctx */
  fundo(ctx, L) {
    const { W, H } = L;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f1e6cc');
    g.addColorStop(1, '#e0cfa9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // linhas de rastelo onduladas
    ctx.strokeStyle = 'rgba(140,110,70,0.13)';
    ctx.lineWidth = 1.6;
    for (let y = 6; y < H; y += 9) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin(x * 0.012 + y * 0.03) * 3;
        if (x) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
    const r = Math.min(W, H) * 0.08;
    if (L.retrato) {
      pedra(ctx, W * 0.06, H * 0.975, r * 0.9, 1);
      pedra(ctx, W * 0.94, H * 0.955, r * 1.2, 2);
    } else {
      pedra(ctx, W * 0.93, H * 0.12, r * 0.8, 3);
      pedra(ctx, W * 0.95, H * 0.92, r, 2);
    }
  },

  /** folhas caindo devagar @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    for (let i = 0; i < 6; i++) {
      const vel = 14 + h(i, 2) * 12;
      const y = ((t * vel + h(i, 3) * (L.H + 60)) % (L.H + 60)) - 30;
      const x = h(i, 1) * L.W + Math.sin(t * 0.8 + i * 2) * 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 1.3 + i) * 0.9);
      ctx.fillStyle = i % 2 ? 'rgba(206,120,70,0.75)' : 'rgba(150,170,80,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },

  /** moldura de madeira, cama de areia, quadrantes alternados @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L, op) {
    const { tab, cs, n } = L;
    const pad = cs * 0.28;
    arredondado(ctx, tab.x - pad, tab.y - pad, tab.w + pad * 2, tab.h + pad * 2, cs * 0.3);
    const g = ctx.createLinearGradient(0, tab.y - pad, 0, tab.y + tab.h + pad);
    g.addColorStop(0, '#b98a56');
    g.addColorStop(1, '#84592f');
    ctx.fillStyle = g;
    ctx.fill();
    // veios
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,40,15,0.2)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      const y = tab.y - pad + ((k + 0.5) / 14) * (tab.h + pad * 2);
      ctx.beginPath();
      ctx.moveTo(tab.x - pad, y);
      ctx.bezierCurveTo(tab.x + tab.w * 0.3, y + 4, tab.x + tab.w * 0.7, y - 4, tab.x + tab.w + pad, y + 2);
      ctx.stroke();
    }
    ctx.restore();
    // cama de areia
    ctx.fillStyle = '#e6d6b1';
    ctx.fillRect(tab.x - 2, tab.y - 2, tab.w + 4, tab.h + 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = tab.x + x * cs;
        const py = tab.y + y * cs;
        const q = op.quadrantes ? (Math.floor(x / 3) + Math.floor(y / 3)) % 2 : (x + y) % 2;
        ctx.fillStyle = q ? '#dccaa2' : '#e8d9b6';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = 'rgba(140,110,70,0.18)';
        ctx.lineWidth = 1;
        for (let k = 1; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(px + cs * 0.18, py + (cs * k) / 3);
          ctx.lineTo(px + cs * 0.82, py + (cs * k) / 3);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = 'rgba(120,90,55,0.25)';
    ctx.lineWidth = 1;
    for (let k = 1; k < n; k++) {
      ctx.beginPath();
      ctx.moveTo(tab.x + k * cs, tab.y);
      ctx.lineTo(tab.x + k * cs, tab.y + tab.h);
      ctx.moveTo(tab.x, tab.y + k * cs);
      ctx.lineTo(tab.x + tab.w, tab.y + k * cs);
      ctx.stroke();
    }
    if (op.quadrantes) {
      ctx.strokeStyle = '#8d6238';
      ctx.lineWidth = Math.max(2, cs * 0.07);
      for (let k = 3; k < n; k += 3) {
        ctx.beginPath();
        ctx.moveTo(tab.x + k * cs, tab.y);
        ctx.lineTo(tab.x + k * cs, tab.y + tab.h);
        ctx.moveTo(tab.x, tab.y + k * cs);
        ctx.lineTo(tab.x + tab.w, tab.y + k * cs);
        ctx.stroke();
      }
    }
  },

  /** pedra de rio lisa @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.045;
    // sombra na areia
    ctx.fillStyle = 'rgba(80,60,30,0.25)';
    arredondado(ctx, m + s * 0.03, m + s * 0.07, s - m * 2, s - m * 2, s * 0.32);
    ctx.fill();
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.32);
    const g = ctx.createLinearGradient(0, m, 0, s - m);
    g.addColorStop(0, clarear(cor, 0.22));
    g.addColorStop(0.6, cor);
    g.addColorStop(1, escurecer(cor, 0.22));
    ctx.fillStyle = g;
    ctx.fill();
    // pintinhas da pedra
    ctx.fillStyle = alfa(escurecer(cor, 0.35), 0.35);
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.arc(s * (0.22 + h(k, 9) * 0.56), s * (0.3 + h(k, 11) * 0.5), s * 0.022, 0, TAU);
      ctx.fill();
    }
    // brilho fosco
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.ellipse(s * 0.4, s * 0.27, s * 0.24, s * 0.09, -0.15, 0, TAU);
    ctx.fill();
  },

  /** @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    const m = s * 0.06;
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.2);
    ctx.fillStyle = '#4b4a48';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.3);
    ctx.lineTo(s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.7, s * 0.35);
    ctx.stroke();
  },

  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, ['#d8c49a', '#c8b083', '#efe2c4'], 6, { forma: 'c', tam: c.s * 0.1, forca: 0.5, g: 300, vida: 0.5 });
    fx.anel(cx, cy, 'rgba(140,105,60,0.55)', c.s * 1.1, 0.7);
    if (c.k % 3 === 0) fx.estourar(cx, cy, ['#93ad4f', '#cf7a58'], 1, { forma: 'folha', tam: c.s * 0.35, forca: 0.6, g: 60, vida: 1.1, vr: 3 });
  },

  /** onda clara passando pela unidade */
  limparGrupo(fx, L, g) {
    const r = areaGrupo(L, g);
    fx.efeito(0.55, (ctx, u) => {
      ctx.fillStyle = `rgba(255,250,235,${0.45 * Math.sin(u * Math.PI)})`;
      arredondado(ctx, r.x, r.y, r.w, r.h, L.cs * 0.25);
      ctx.fill();
    }, false);
  },

  colocar(fx, cels) {
    for (const c of cels) fx.estourar(c.x + c.s / 2, c.y + c.s, ['#d8c49a', '#efe2c4'], 2, { forma: 'c', tam: c.s * 0.07, forca: 0.3, g: 300, vida: 0.35, sobe: 30 });
  },
};

// Tema 4 - Neon Arcade: noite synthwave com sol listrado e chao quadriculado andando, tabuleiro de
// vidro preto com borda neon, blocos de contorno luminoso. A linha limpa vira um laser.
// Mecanica padrao: bombas-relogio.

import { TAU, alfa, arredondado, clarear, misturar } from '../../src/render/desenho.js';
import { areaGrupo, h } from './util.js';

const COR = ['#ff3df2', '#26f7ff', '#a6ff3a', '#ffe83d', '#ff8a2a', '#a46bff'];

export default {
  id: 'neon',
  nome: 'Neon Arcade',
  mec: 4,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#3a3550',
  hud: { texto: '#ffffff', suave: '#9ef7ff', contorno: 'rgba(60,0,80,0.9)', destaque: '#26f7ff', combo: '#ff3df2', coroa: '#ffe83d' },
  painel: { fundo: '#12062a', borda: '#ff3df2', texto: '#ffffff', botao: '#1fb6c9' },
  folga: 0.4,
  pouso: 0.1,
  saida: 'cresce',
  timbre: { raiz: 69, onda: 'triangle', harmonico: 2, volHarm: 0.3, queda: 0.2, brilho: 4200, ruido: 4000, volRuido: 0.05, pousoHz: 300, glide: 0.6 },

  /** @param {CanvasRenderingContext2D} ctx */
  fundo(ctx, L) {
    const { W, H, tab } = L;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07011a');
    g.addColorStop(0.55, '#1b0640');
    g.addColorStop(1, '#2a0748');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sol listrado atras do tabuleiro
    const cx = W / 2;
    const R = Math.min(W, tab.w) * 0.42;
    const cy = tab.y + R * 0.1;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    sg.addColorStop(0, '#ffe83d');
    sg.addColorStop(0.5, '#ff6a8a');
    sg.addColorStop(1, '#b8268f');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = '#1b0640';
    for (let k = 0; k < 7; k++) {
      const y = cy + R * (0.05 + k * 0.14);
      ctx.fillRect(cx - R, y, R * 2, 2 + k * 1.6);
    }
    ctx.restore();
    // estrelinhas
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let k = 0; k < 50; k++) ctx.fillRect(h(k, 1) * W, h(k, 2) * Math.max(1, cy - R), 1.5, 1.5);
  },

  /** chao quadriculado vindo na direcao de quem joga @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    const { W, H } = L;
    const hz = L.retrato ? L.tab.y + L.tab.h * 0.75 : H * 0.55;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,61,242,0.35)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 10; k++) {
      const f = ((k + (t * 0.6) % 1) / 10);
      const y = hz + (H - hz) * f * f;
      ctx.globalAlpha = Math.min(1, f * 2);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    for (let k = -8; k <= 8; k++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + k * W * 0.05, hz);
      ctx.lineTo(W / 2 + k * W * 0.32, H);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** vidro preto com borda neon @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L) {
    const { tab, cs, n } = L;
    const pad = cs * 0.22;
    const caixa = () => arredondado(ctx, tab.x - pad, tab.y - pad, tab.w + pad * 2, tab.h + pad * 2, cs * 0.22);
    caixa();
    ctx.fillStyle = 'rgba(6,2,16,0.9)';
    ctx.fill();
    for (const [lw, a] of [[14, 0.08], [8, 0.16], [4, 0.4], [2, 1]]) {
      caixa();
      ctx.lineWidth = lw;
      ctx.strokeStyle = alfa('#26f7ff', a);
      ctx.stroke();
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        arredondado(ctx, tab.x + x * cs + 3, tab.y + y * cs + 3, cs - 6, cs - 6, cs * 0.14);
        ctx.strokeStyle = 'rgba(38,247,255,0.13)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  },

  /** contorno neon com nucleo escuro @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.08;
    const caixa = () => arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.16);
    ctx.save();
    ctx.shadowColor = cor;
    ctx.shadowBlur = s * 0.35;
    caixa();
    ctx.fillStyle = misturar('#0b0418', cor, 0.22);
    ctx.fill();
    ctx.restore();
    caixa();
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s * 0.55);
    g.addColorStop(0, alfa(cor, 0.05));
    g.addColorStop(1, alfa(cor, 0.55));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.strokeStyle = cor;
    caixa();
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.025);
    ctx.strokeStyle = clarear(cor, 0.75);
    caixa();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(s * 0.22, s * 0.22, s * 0.14, s * 0.05);
  },

  /** @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    const m = s * 0.08;
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.12);
    ctx.fillStyle = '#2a2638';
    ctx.fill();
    ctx.strokeStyle = '#5c5675';
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m * 2, m * 2);
    ctx.lineTo(s - m * 2, s - m * 2);
    ctx.moveTo(s - m * 2, m * 2);
    ctx.lineTo(m * 2, s - m * 2);
    ctx.stroke();
  },

  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, [c.cor, '#ffffff'], 7, { forma: 'q', tam: c.s * 0.16, forca: 1.1, g: 200, vida: 0.55, mistura: 'lighter', vr: 0 });
  },

  /** laser na unidade limpa */
  limparGrupo(fx, L, g) {
    const r = areaGrupo(L, g);
    const horiz = r.w >= r.h;
    const cor = g.pura ? '#ffe83d' : '#26f7ff';
    fx.efeito(0.42, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
      const esp = (horiz ? r.h : r.w) * (0.25 + (1 - u) * 0.9);
      const cxl = r.x + r.w / 2;
      const cyl = r.y + r.h / 2;
      const ext = 60;
      ctx.fillStyle = alfa(cor, 0.35 * a);
      if (horiz) ctx.fillRect(r.x - ext, cyl - esp / 2, r.w + ext * 2, esp);
      else ctx.fillRect(cxl - esp / 2, r.y - ext, esp, r.h + ext * 2);
      ctx.fillStyle = alfa('#ffffff', 0.9 * a);
      const nucleo = esp * 0.18;
      if (horiz) ctx.fillRect(r.x - ext, cyl - nucleo / 2, r.w + ext * 2, nucleo);
      else ctx.fillRect(cxl - nucleo / 2, r.y - ext, nucleo, r.h + ext * 2);
    });
  },
};

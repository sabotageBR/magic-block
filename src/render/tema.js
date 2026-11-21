// Tema do Magic Block: a Galaxia do modelo 5 (modelos/temas/galaxia.js), escolhida em 2026-11-18.
// Espaco profundo com nebulosas, estrelas que piscam em paralaxe e um cometa de vez em quando;
// tabuleiro como janela de nave; blocos sao cristais estelares de nucleo brilhante. Na limpeza sobe
// poeira de estrela e um cometa corre a linha; varias linhas, combo e tabuleiro limpo ganham onda de
// choque, clarao de nebulosa e chuva de estrelas (multi, combo, perfeito).

import { TAU, alfa, arredondado, clarear, escurecer, estrela } from './desenho.js';
import { areaGrupo, h } from './util.js';

/** onda de choque: anel que cresce do centro do tabuleiro */
function onda(fx, L, cor, larg, vida) {
  const cx = L.tab.x + L.tab.w / 2;
  const cy = L.tab.y + L.tab.h / 2;
  fx.efeito(vida, (ctx, u) => {
    ctx.globalCompositeOperation = 'lighter';
    const r = L.tab.w * (0.15 + u * 0.95);
    ctx.strokeStyle = alfa(cor, 0.55 * (1 - u));
    ctx.lineWidth = larg * (1 - u * 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  });
}

const COR = ['#4da3ff', '#ff6ad5', '#ffcf5a', '#3ff0c8', '#a77bff', '#ff7b6a'];

export default {
  id: 'galaxia',
  nome: 'Magic Block',
  mec: 7,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#5a5f78',
  hud: { texto: '#ffffff', suave: '#b9c6ff', contorno: 'rgba(5,6,25,0.85)', destaque: '#ffe066', combo: '#7fe8ff', coroa: '#ffd54a' },
  painel: { fundo: '#0d1030', borda: '#7fa8ff', texto: '#ffffff', botao: '#5b6cff' },
  folga: 0.22,
  pouso: 0.1,
  saida: 'encolhe',
  timbre: { raiz: 64, onda: 'sine', harmonico: 1.5, volHarm: 0.3, queda: 0.6, brilho: 3600, ruido: 6000, volRuido: 0.03, pousoHz: 200, glide: 0.9 },

  /** @param {CanvasRenderingContext2D} ctx */
  fundo(ctx, L) {
    const { W, H } = L;
    const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, '#03040f');
    g.addColorStop(1, '#140a33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const [fx, fy, r, c] of [[0.15, 0.2, 0.55, '#6b2fbf'], [0.85, 0.75, 0.6, '#1f6f8f'], [0.7, 0.1, 0.35, '#b23a8a']]) {
      const n = ctx.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, Math.max(W, H) * r);
      n.addColorStop(0, alfa(c, 0.32));
      n.addColorStop(1, alfa(c, 0));
      ctx.fillStyle = n;
      ctx.fillRect(0, 0, W, H);
    }
    for (let k = 0; k < 160; k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + h(k, 3) * 0.5})`;
      const r = 0.4 + h(k, 4) * 0.9;
      ctx.beginPath();
      ctx.arc(h(k, 1) * W, h(k, 2) * H, r, 0, TAU);
      ctx.fill();
    }
  },

  /** estrelas que piscam, paralaxe lenta e cometa @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    const { W, H } = L;
    ctx.save();
    for (let k = 0; k < 22; k++) {
      const x = (h(k, 5) * W + t * (4 + h(k, 6) * 8)) % W;
      const y = h(k, 7) * H;
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + h(k, 8) * 1.5) + k));
      ctx.fillStyle = alfa(k % 4 ? '#ffffff' : '#9fd8ff', a);
      estrela(ctx, x, y, 2.6 + h(k, 9) * 2, 0.8, 4);
      ctx.fill();
    }
    // cometa a cada 7 s
    const ciclo = t % 7;
    if (ciclo < 1.2) {
      const u = ciclo / 1.2;
      const x = W * (1.1 - u * 1.3);
      const y = H * (0.08 + u * 0.3);
      const cauda = ctx.createLinearGradient(x, y, x + 90, y - 30);
      cauda.addColorStop(0, 'rgba(255,255,255,0.9)');
      cauda.addColorStop(1, 'rgba(160,200,255,0)');
      ctx.strokeStyle = cauda;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 90, y - 30);
      ctx.stroke();
    }
    ctx.restore();
  },

  /** janela de nave @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L) {
    const { tab, cs, n } = L;
    const pad = cs * 0.24;
    arredondado(ctx, tab.x - pad, tab.y - pad, tab.w + pad * 2, tab.h + pad * 2, cs * 0.32);
    ctx.fillStyle = 'rgba(8,12,38,0.78)';
    ctx.fill();
    const borda = ctx.createLinearGradient(tab.x, tab.y, tab.x + tab.w, tab.y + tab.h);
    borda.addColorStop(0, '#8fb6ff');
    borda.addColorStop(1, '#b07bff');
    ctx.lineWidth = 3;
    ctx.strokeStyle = borda;
    ctx.stroke();
    // rebites
    ctx.fillStyle = '#8fb6ff';
    for (const [x, y] of [[tab.x - pad * 0.5, tab.y - pad * 0.5], [tab.x + tab.w + pad * 0.5, tab.y - pad * 0.5], [tab.x - pad * 0.5, tab.y + tab.h + pad * 0.5], [tab.x + tab.w + pad * 0.5, tab.y + tab.h + pad * 0.5]]) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, cs * 0.05), 0, TAU);
      ctx.fill();
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = tab.x + x * cs;
        const py = tab.y + y * cs;
        arredondado(ctx, px + 2.5, py + 2.5, cs - 5, cs - 5, cs * 0.2);
        ctx.fillStyle = 'rgba(140,170,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,170,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,200,255,0.18)';
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, 1.2, 0, TAU);
        ctx.fill();
      }
    }
  },

  /** cristal estelar de nucleo brilhante @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.06;
    ctx.save();
    ctx.shadowColor = alfa(cor, 0.7);
    ctx.shadowBlur = s * 0.2;
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.24);
    const g = ctx.createRadialGradient(s * 0.45, s * 0.42, s * 0.04, s * 0.5, s * 0.5, s * 0.62);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, clarear(cor, 0.55));
    g.addColorStop(0.65, cor);
    g.addColorStop(1, escurecer(cor, 0.4));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeStyle = alfa(clarear(cor, 0.6), 0.9);
    arredondado(ctx, m, m, s - m * 2, s - m * 2, s * 0.24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    estrela(ctx, s * 0.3, s * 0.28, s * 0.12, s * 0.025, 4);
    ctx.fill();
  },

  /** asteroide @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    ctx.fillStyle = '#5a5f78';
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      const r = s * (0.38 + h(k, 2) * 0.08);
      const x = s / 2 + Math.cos(a) * r;
      const y = s / 2 + Math.sin(a) * r;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f4357';
    ctx.beginPath();
    ctx.arc(s * 0.4, s * 0.42, s * 0.09, 0, TAU);
    ctx.arc(s * 0.62, s * 0.6, s * 0.06, 0, TAU);
    ctx.fill();
  },

  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, ['#ffffff', clarear(c.cor, 0.5), c.cor], 6, { forma: ['brilho', 'c'], tam: c.s * 0.22, forca: 0.7, g: 0, arrasto: 0.95, vida: 0.8, mistura: 'lighter', vr: 3 });
    fx.subir(cx, cy, [clarear(c.cor, 0.6)], 2, { tam: c.s * 0.08, vida: 0.9, mistura: 'lighter' });
  },

  /** cometa correndo a unidade */
  limparGrupo(fx, L, g) {
    const r = areaGrupo(L, g);
    const horiz = r.w >= r.h;
    fx.efeito(0.5, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const k = 1 - Math.pow(1 - u, 2);
      const x = horiz ? r.x - 20 + (r.w + 40) * k : r.x + r.w / 2;
      const y = horiz ? r.y + r.h / 2 : r.y - 20 + (r.h + 40) * k;
      const dx = horiz ? -L.cs * 2.5 : 0;
      const dy = horiz ? 0 : -L.cs * 2.5;
      const gr = ctx.createLinearGradient(x, y, x + dx, y + dy);
      gr.addColorStop(0, `rgba(255,255,255,${1 - u})`);
      gr.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = L.cs * 0.28;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${1 - u})`;
      estrela(ctx, x, y, L.cs * 0.3, L.cs * 0.06, 4);
      ctx.fill();
    });
  },
  /** 2 ou mais unidades juntas: onda de choque e clarao de nebulosa */
  multi(fx, L, k) {
    onda(fx, L, k >= 3 ? '#ffe066' : '#9fd8ff', L.cs * (0.25 + k * 0.08), 0.7);
    fx.efeito(0.45, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h / 2, 0, L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h / 2, L.tab.w * 0.8);
      g.addColorStop(0, `rgba(170,140,255,${0.28 * (1 - u) * Math.min(1, k / 3)})`);
      g.addColorStop(1, 'rgba(170,140,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L.W, L.H);
    }, false);
    if (k >= 3) {
      for (let i = 0; i < 3; i++) fx.estourar(L.tab.x + L.tab.w * (0.25 + i * 0.25), L.tab.y + L.tab.h * 0.5, ['#ffffff', '#ffe066', '#9fd8ff'], 10, { forma: 'brilho', tam: L.cs * 0.4, g: 0, forca: 1.6, arrasto: 0.95, vida: 0.9, mistura: 'lighter' });
    }
  },

  /** combo alto: estrelas subindo das bordas do tabuleiro */
  combo(fx, L, seq) {
    const n = Math.min(14, 4 + seq);
    for (let i = 0; i < n; i++) {
      const x = L.tab.x + (L.tab.w * (i + 0.5)) / n;
      fx.subir(x, L.tab.y + L.tab.h, ['#ffe066', '#9fd8ff', '#ff9be6'], 1, { forma: 'estrela', tam: L.cs * 0.3, vida: 1.1, forca: 2.2, g: 40, mistura: 'lighter' });
    }
  },

  /** tabuleiro limpo: supernova */
  perfeito(fx, L) {
    const cx = L.tab.x + L.tab.w / 2;
    const cy = L.tab.y + L.tab.h / 2;
    onda(fx, L, '#ffffff', L.cs * 0.6, 0.9);
    onda(fx, L, '#ffe066', L.cs * 0.4, 1.2);
    fx.efeito(0.9, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L.tab.w * (0.3 + u));
      g.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - u)})`);
      g.addColorStop(0.4, `rgba(255,220,140,${0.35 * (1 - u)})`);
      g.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, L.W, L.H);
    });
    fx.estourar(cx, cy, ['#ffffff', '#ffe066', '#9fd8ff', '#ff9be6'], 46, { forma: ['estrela', 'brilho', 'c'], tam: L.cs * 0.38, g: 60, forca: 2.4, arrasto: 0.96, vida: 1.4, mistura: 'lighter' });
  },
};

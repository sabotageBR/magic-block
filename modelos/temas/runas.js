// Tema 1 - Runas Arcanas: pedra escura com runas gravadas, cristais lapidados com brilho interno,
// circulo magico atras do tabuleiro e faiscas subindo. Na limpeza os cristais estilhacam e a runa da
// linha acende. Mecanica padrao: Orbe de mana.

import { TAU, alfa, arredondado, clarear, escurecer, estrela } from '../../src/render/desenho.js';

const COR = ['#a66bff', '#38d3ff', '#ffb238', '#3ee08f', '#ff4f7a', '#5b7cff'];

/** hash pequeno e deterministico */
const h = (i, k = 1) => {
  let x = Math.imul(i * 374761393 + k * 668265263, 1274126177) >>> 0;
  x ^= x >>> 13;
  return (Math.imul(x, 1103515245) >>> 0) / 4294967296;
};

/** Runa gravada: 2 ou 3 riscos numa grade 3x3 dentro da casa. @param {CanvasRenderingContext2D} ctx */
function runa(ctx, x, y, s, i) {
  const p = (k) => [x + s * (0.28 + (k % 3) * 0.22), y + s * (0.28 + Math.floor(k / 3) * 0.22)];
  const n = 2 + Math.floor(h(i, 3) * 2);
  ctx.beginPath();
  let a = Math.floor(h(i, 5) * 9);
  for (let k = 0; k < n; k++) {
    const b = (a + 1 + Math.floor(h(i, 7 + k) * 7)) % 9;
    const [x1, y1] = p(a);
    const [x2, y2] = p(b);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    a = b;
  }
  ctx.stroke();
}

export default {
  id: 'runas',
  nome: 'Runas Arcanas',
  mec: 1,
  fonte: 'Fredoka, system-ui, sans-serif',
  cores: COR,
  entulho: '#5b5468',
  hud: { texto: '#ffffff', suave: '#cdbcff', contorno: 'rgba(20,8,40,0.75)', destaque: '#ffe27a', combo: '#7ef3ff', coroa: '#ffcf4a' },
  painel: { fundo: '#24163f', borda: '#9c7cff', texto: '#ffffff', botao: '#7b4dff' },
  folga: 0.2,
  pouso: 0.1,
  saida: 'cresce',
  timbre: { raiz: 72, onda: 'sine', harmonico: 2.76, volHarm: 0.35, queda: 0.5, brilho: 5200, ruido: 3200, volRuido: 0.05, pousoHz: 230, glide: 0.8 },

  /** @param {CanvasRenderingContext2D} ctx @param {any} L */
  fundo(ctx, L) {
    const { W, H, tab } = L;
    const g = ctx.createRadialGradient(tab.x + tab.w / 2, tab.y + tab.h / 2, 10, tab.x + tab.w / 2, tab.y + tab.h / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#3a1e6b');
    g.addColorStop(0.55, '#1d0f3a');
    g.addColorStop(1, '#0c0619');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // circulo magico
    const cx = tab.x + tab.w / 2;
    const cy = tab.y + tab.h / 2;
    const R = tab.w * 0.78;
    ctx.save();
    ctx.strokeStyle = alfa('#b89cff', 0.12);
    ctx.lineWidth = 2;
    for (const r of [R, R * 0.92, R * 1.12]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const a1 = (k / 6) * TAU - Math.PI / 2;
      const a2 = ((k + 2) / 6) * TAU - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a1) * R * 0.92, cy + Math.sin(a1) * R * 0.92);
      ctx.lineTo(cx + Math.cos(a2) * R * 0.92, cy + Math.sin(a2) * R * 0.92);
      ctx.stroke();
    }
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.lineTo(cx + Math.cos(a) * R * (k % 3 ? 1.04 : 1.1), cy + Math.sin(a) * R * (k % 3 ? 1.04 : 1.1));
      ctx.stroke();
    }
    ctx.restore();
    // vinheta
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  },

  /** faiscas subindo devagar @param {CanvasRenderingContext2D} ctx */
  fundoVivo(ctx, L, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const vel = 10 + h(i, 2) * 18;
      const y = L.H + 20 - ((t * vel + h(i, 3) * (L.H + 40)) % (L.H + 40));
      const x = h(i, 1) * L.W + Math.sin(t * 0.6 + i) * 14;
      const r = 1 + h(i, 4) * 2.2;
      const a = 0.25 + 0.25 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = alfa(i % 3 ? '#9f7bff' : '#5fe3ff', a);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = alfa('#ffffff', a);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  /** @param {CanvasRenderingContext2D} ctx */
  tabuleiro(ctx, L) {
    const { tab, cs, n } = L;
    const pad = cs * 0.2;
    arredondado(ctx, tab.x - pad, tab.y - pad, tab.w + pad * 2, tab.h + pad * 2, cs * 0.35);
    const g = ctx.createLinearGradient(0, tab.y - pad, 0, tab.y + tab.h + pad);
    g.addColorStop(0, '#2c2245');
    g.addColorStop(1, '#17112a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = alfa('#9c7cff', 0.55);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = alfa('#ffffff', 0.08);
    arredondado(ctx, tab.x - pad + 4, tab.y - pad + 4, tab.w + pad * 2 - 8, tab.h + pad * 2 - 8, cs * 0.3);
    ctx.stroke();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = tab.x + x * cs;
        const py = tab.y + y * cs;
        arredondado(ctx, px + 2, py + 2, cs - 4, cs - 4, cs * 0.16);
        ctx.fillStyle = '#211938';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = alfa('#b89cff', 0.09);
        ctx.lineWidth = Math.max(1, cs * 0.04);
        ctx.lineCap = 'round';
        runa(ctx, px, py, cs, y * n + x);
      }
    }
  },

  /** Cristal lapidado. @param {CanvasRenderingContext2D} ctx */
  pintarBloco(ctx, s, cor) {
    const m = s * 0.05;
    const a = m;
    const b = s - m;
    const i0 = s * 0.27;
    const i1 = s - i0;
    // corpo
    arredondado(ctx, a, a, b - a, b - a, s * 0.16);
    const g = ctx.createLinearGradient(a, a, b, b);
    g.addColorStop(0, clarear(cor, 0.25));
    g.addColorStop(1, escurecer(cor, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    // facetas
    const faceta = (pts, c) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
    };
    const r = s * 0.1;
    faceta([a + r, a, b - r, a, i1, i0, i0, i0], clarear(cor, 0.42));
    faceta([a, a + r, i0, i0, i0, i1, a, b - r], clarear(cor, 0.18));
    faceta([b, a + r, b, b - r, i1, i1, i1, i0], escurecer(cor, 0.12));
    faceta([a + r, b, i0, i1, i1, i1, b - r, b], escurecer(cor, 0.3));
    // mesa com brilho interno
    const rg = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, (i1 - i0) * 0.75);
    rg.addColorStop(0, clarear(cor, 0.6));
    rg.addColorStop(1, clarear(cor, 0.12));
    ctx.fillStyle = rg;
    ctx.fillRect(i0, i0, i1 - i0, i1 - i0);
    // brilho
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(i0 + s * 0.04, i0 + s * 0.04);
    ctx.lineTo(i0 + s * 0.2, i0 + s * 0.04);
    ctx.lineTo(i0 + s * 0.04, i0 + s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeStyle = escurecer(cor, 0.55);
    arredondado(ctx, a, a, b - a, b - a, s * 0.16);
    ctx.stroke();
  },

  /** pedra rachada @param {CanvasRenderingContext2D} ctx */
  pintarEntulho(ctx, s) {
    arredondado(ctx, s * 0.05, s * 0.05, s * 0.9, s * 0.9, s * 0.14);
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#6f6782');
    g.addColorStop(1, '#3c3649');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.3);
    ctx.lineTo(s * 0.45, s * 0.45);
    ctx.lineTo(s * 0.4, s * 0.7);
    ctx.moveTo(s * 0.45, s * 0.45);
    ctx.lineTo(s * 0.78, s * 0.38);
    ctx.stroke();
  },

  /** @param {any} fx */
  limpar(fx, c) {
    const cx = c.x + c.s / 2;
    const cy = c.y + c.s / 2;
    fx.estourar(cx, cy, [c.cor, clarear(c.cor, 0.4), clarear(c.cor, 0.7)], 7, { forma: 'tri', tam: c.s * 0.26, forca: 0.9, g: 600, vida: 0.65 });
    fx.estourar(cx, cy, ['#ffffff', clarear(c.cor, 0.6)], 3, { forma: 'brilho', tam: c.s * 0.3, forca: 0.4, g: 0, vida: 0.5, mistura: 'lighter', vr: 2 });
  },

  /** a runa da linha acende: faixa de luz com simbolos correndo */
  limparGrupo(fx, L, g) {
    const { tab, cs, n } = L;
    const cor = g.pura ? '#ffe27a' : '#b89cff';
    fx.efeito(0.5, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const a = Math.sin(u * Math.PI);
      let x; let y; let w; let hh;
      if (g.tipo === 'linha') { x = tab.x; y = tab.y + g.k * cs; w = tab.w; hh = cs; }
      else if (g.tipo === 'coluna') { x = tab.x + g.k * cs; y = tab.y; w = cs; hh = tab.h; }
      else { const m = n / 3; x = tab.x + (g.k % m) * 3 * cs; y = tab.y + Math.floor(g.k / m) * 3 * cs; w = cs * 3; hh = cs * 3; }
      ctx.fillStyle = alfa(cor, 0.35 * a);
      arredondado(ctx, x - 3, y - 3, w + 6, hh + 6, cs * 0.2);
      ctx.fill();
      ctx.strokeStyle = alfa('#ffffff', 0.7 * a);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = alfa('#ffffff', a);
      const horiz = w >= hh;
      for (let k = 0; k < 4; k++) {
        const f = (u * 1.4 + k / 4) % 1;
        const px = horiz ? x + w * f : x + w / 2;
        const py = horiz ? y + hh / 2 : y + hh * f;
        estrela(ctx, px, py, cs * 0.16, cs * 0.05, 4);
        ctx.fill();
      }
    });
  },

  /** Feitico: explosao em cruz */
  magia(fx, L, i) {
    const { tab, cs, n } = L;
    const gx = i % n;
    const gy = Math.floor(i / n);
    const cx = tab.x + (gx + 0.5) * cs;
    const cy = tab.y + (gy + 0.5) * cs;
    fx.efeito(0.6, (ctx, u) => {
      ctx.globalCompositeOperation = 'lighter';
      const a = 1 - u;
      const lg = cs * (0.4 + u * 0.6);
      ctx.fillStyle = alfa('#c9a7ff', 0.55 * a);
      ctx.fillRect(tab.x, cy - lg / 2, tab.w, lg);
      ctx.fillRect(cx - lg / 2, tab.y, lg, tab.h);
      ctx.fillStyle = alfa('#ffffff', 0.8 * a);
      ctx.fillRect(tab.x, cy - lg * 0.12, tab.w, lg * 0.24);
      ctx.fillRect(cx - lg * 0.12, tab.y, lg * 0.24, tab.h);
    });
    fx.anel(cx, cy, '#e3d4ff', cs * 4, 0.6, 'lighter');
    fx.estourar(cx, cy, ['#ffffff', '#c9a7ff', '#7ef3ff'], 24, { forma: 'brilho', tam: cs * 0.35, g: 0, forca: 1.4, mistura: 'lighter' });
  },

  /** Bola de cristal com mana liquida; cheia, brilha e gira runas. @param {CanvasRenderingContext2D} ctx */
  orbe(ctx, o, mana, pronto, t) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const r = o.w / 2;
    ctx.save();
    if (pronto) {
      const gl = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.6);
      gl.addColorStop(0, alfa('#c9a7ff', 0.55 + 0.2 * Math.sin(t * 5)));
      gl.addColorStop(1, alfa('#c9a7ff', 0));
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = '#140b28';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const nivel = o.y + o.h * (1 - mana);
    const lg = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    lg.addColorStop(0, '#7ef3ff');
    lg.addColorStop(1, '#8a4dff');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h);
    for (let k = 0; k <= 12; k++) {
      const x = o.x + (o.w * k) / 12;
      ctx.lineTo(x, nivel + Math.sin(t * 3 + k * 0.9) * r * 0.06 * (mana > 0.02 && mana < 0.98 ? 1 : 0));
    }
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // vidro
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = pronto ? '#ffffff' : '#9c7cff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, TAU);
    ctx.fill();
    if (pronto) {
      ctx.fillStyle = '#ffffff';
      estrela(ctx, cx, cy, r * 0.42, r * 0.14, 4);
      ctx.fill();
      ctx.strokeStyle = alfa('#ffffff', 0.7);
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const a = t * 1.2 + (k / 6) * TAU;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 1.22, cy + Math.sin(a) * r * 1.22, r * 0.07, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

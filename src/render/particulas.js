// Particulas, textos flutuantes e efeitos livres (funcoes do tempo), base no criarParticulas do
// 2048-cards: tudo e funcao do dt e o sorteio tem semente propria (o mesmo filme sai igual).
//
// Particula: { x, y, vx, vy, g, vida, t, tam, cor, forma, rot, vr, arrasto, osc, mistura, encolhe }
// Formas: q (quadrado), c (circulo), tri (estilhaco), estrela, faisca (risco na direcao da velocidade),
// bolha (circulo vazado), confete (retangulo que gira achatado), folha, anel (cresce e some).
// Efeito: { t, vida, desenhar(ctx, u) } com u = idade 0..1 (laser, onda, flash de runa...).

const TAU = Math.PI * 2;

/** @param {CanvasRenderingContext2D} ctx @param {number} r @param {number} ri */
function caminhoEstrela(ctx, r, ri, pontas = 5) {
  ctx.beginPath();
  for (let k = 0; k < pontas * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / pontas;
    const rr = k % 2 ? ri : r;
    if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function criarParticulas() {
  /** @type {any[]} */ let ps = [];
  /** @type {any[]} */ let txts = [];
  /** @type {any[]} */ let efs = [];
  let s = 7;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

  /** @type {Record<string, (ctx: CanvasRenderingContext2D, p: any, u: number) => void>} */
  const formas = {
    q: (ctx, p) => ctx.fillRect(-p.tam / 2, -p.tam / 2, p.tam, p.tam),
    c: (ctx, p) => { ctx.beginPath(); ctx.arc(0, 0, p.tam / 2, 0, TAU); ctx.fill(); },
    tri: (ctx, p) => {
      ctx.beginPath();
      ctx.moveTo(0, -p.tam * 0.6);
      ctx.lineTo(p.tam * 0.5, p.tam * 0.4);
      ctx.lineTo(-p.tam * 0.45, p.tam * 0.3);
      ctx.closePath();
      ctx.fill();
    },
    estrela: (ctx, p) => { caminhoEstrela(ctx, p.tam / 2, p.tam / 4.6); ctx.fill(); },
    brilho: (ctx, p) => { caminhoEstrela(ctx, p.tam / 2, p.tam / 9, 4); ctx.fill(); },
    faisca: (ctx, p) => {
      const v = Math.hypot(p.vx, p.vy) || 1;
      const comp = Math.min(p.tam * 4, v * 0.05);
      ctx.rotate(Math.atan2(p.vy, p.vx) - p.rot);
      ctx.lineWidth = Math.max(1, p.tam * 0.35);
      ctx.strokeStyle = p.cor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-comp, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
    },
    bolha: (ctx, p) => {
      ctx.lineWidth = Math.max(1, p.tam * 0.12);
      ctx.strokeStyle = p.cor;
      ctx.beginPath();
      ctx.arc(0, 0, p.tam / 2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.arc(-p.tam * 0.16, -p.tam * 0.16, p.tam * 0.1, 0, TAU);
      ctx.fill();
    },
    confete: (ctx, p) => {
      const k = Math.cos(p.t * 9 + p.fase);
      ctx.fillRect(-p.tam / 2, (-p.tam / 4) * k, p.tam, (p.tam / 2) * k);
    },
    folha: (ctx, p) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.tam / 2, p.tam / 4.5, 0, 0, TAU);
      ctx.fill();
    },
    anel: (ctx, p, u) => {
      ctx.lineWidth = Math.max(1, p.tam * 0.08 * (1 - u));
      ctx.strokeStyle = p.cor;
      ctx.beginPath();
      ctx.arc(0, 0, p.tam * (0.25 + u * 0.9), 0, TAU);
      ctx.stroke();
    },
  };

  /** @param {any} p */
  function add(p) {
    const q = { vx: 0, vy: 0, g: 0, t: 0, rot: 0, vr: 0, arrasto: 0.985, forma: 'c', fase: r() * TAU, encolhe: true };
    for (const k of Object.keys(p)) if (p[k] !== undefined) q[k] = p[k];
    ps.push(q);
  }

  /**
   * Estouro em volta de (x, y).
   * @param {number} x
   * @param {number} y
   * @param {string|string[]} cores
   * @param {number} [n]
   * @param {{ forca?: number, g?: number, vida?: number, tam?: number, forma?: string|string[], vr?: number,
   *   sobe?: number, arrasto?: number, mistura?: GlobalCompositeOperation, osc?: number, dir?: number, abre?: number }} [o]
   */
  function estourar(x, y, cores, n = 10, o = {}) {
    const forca = o.forca ?? 1;
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + (r() - 0.5) * (o.abre ?? 1) : r() * TAU;
      const v = (50 + r() * 200) * forca;
      const forma = Array.isArray(o.forma) ? o.forma[i % o.forma.length] : (o.forma || 'q');
      add({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.sobe ?? 50) * forca, g: o.g ?? 480,
        vida: (o.vida || 0.6) * (0.7 + r() * 0.6), tam: (o.tam || 6) * (0.6 + r() * 0.8),
        cor: Array.isArray(cores) ? cores[i % cores.length] : cores, forma,
        rot: r() * TAU, vr: (r() - 0.5) * 2 * (o.vr ?? 8), arrasto: o.arrasto, mistura: o.mistura, osc: o.osc,
      });
    }
  }

  /** Particulas subindo (bolhas, fumaca, poeira de estrela). */
  function subir(x, y, cores, n = 6, o = {}) {
    for (let i = 0; i < n; i++) {
      add({
        x: x + (r() - 0.5) * (o.larg || 20), y: y + (r() - 0.5) * (o.alt || 0), vx: (r() - 0.5) * 30,
        vy: -(30 + r() * 80) * (o.forca || 1), g: o.g ?? -10, vida: (o.vida || 1.1) * (0.7 + r() * 0.6),
        tam: (o.tam || 6) * (0.5 + r()), cor: Array.isArray(cores) ? cores[i % cores.length] : cores,
        forma: o.forma || 'c', arrasto: 0.98, osc: o.osc, mistura: o.mistura, encolhe: o.encolhe ?? true,
      });
    }
  }

  function anel(x, y, cor, tam = 40, vida = 0.5, mistura) { add({ x, y, vida, tam, cor, forma: 'anel', mistura, encolhe: false }); }

  /**
   * Texto flutuante com contorno.
   * @param {number} x @param {number} y @param {string} txt @param {string} cor
   * @param {{ tam?: number, contorno?: string, vida?: number, sobe?: number, pulo?: boolean }} [o]
   */
  function texto(x, y, txt, cor, o = {}) {
    txts.push({ x, y, txt, cor, tam: o.tam || 26, contorno: o.contorno || 'rgba(0,0,0,0.45)', t: 0, vida: o.vida || 0.95, sobe: o.sobe ?? 46, pulo: o.pulo ?? true });
  }

  /** @param {number} vida @param {(ctx: CanvasRenderingContext2D, u: number) => void} desenhar @param {boolean} [frente] */
  function efeito(vida, desenhar, frente = true) { efs.push({ t: 0, vida, desenhar, frente }); }

  /** @param {number} dt */
  function atualizar(dt) {
    for (const p of ps) {
      p.t += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt + (p.osc ? Math.cos(p.t * 4 + p.fase) * p.osc * dt : 0);
      p.y += p.vy * dt;
      const k = Math.pow(p.arrasto, dt * 60);
      p.vx *= k;
      p.vy *= k;
      p.rot += p.vr * dt;
    }
    ps = ps.filter((p) => p.t < p.vida);
    for (const t of txts) t.t += dt;
    txts = txts.filter((t) => t.t < t.vida);
    for (const e of efs) e.t += dt;
    efs = efs.filter((e) => e.t < e.vida);
  }

  /** @param {CanvasRenderingContext2D} ctx @param {boolean} frente efeitos da frente ou de tras */
  function desenharEfeitos(ctx, frente) {
    for (const e of efs) {
      if (e.frente !== frente) continue;
      ctx.save();
      e.desenhar(ctx, Math.min(1, e.t / e.vida));
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function desenhar(ctx) {
    for (const p of ps) {
      const u = p.t / p.vida;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.mistura) ctx.globalCompositeOperation = p.mistura;
      ctx.globalAlpha = p.forma === 'anel' ? 1 - u : Math.min(1, (1 - u) * 2.2);
      const sc = p.encolhe && p.forma !== 'anel' ? 1 - u * 0.55 : 1;
      if (sc !== 1) ctx.scale(sc, sc);
      ctx.fillStyle = p.cor;
      (formas[p.forma] || formas.c)(ctx, p, u);
      ctx.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} ctx @param {string} fonte familia */
  function desenharTextos(ctx, fonte) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const t of txts) {
      const u = t.t / t.vida;
      const pulo = t.pulo ? (u < 0.18 ? 0.6 + (u / 0.18) * 0.55 : 1.15 - Math.min(0.15, (u - 0.18) * 0.6)) : 1;
      const tam = t.tam * pulo;
      ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      ctx.font = `700 ${Math.round(tam)}px ${fonte}`;
      const y = t.y - t.sobe * Math.sqrt(u);
      ctx.lineWidth = Math.max(3, tam * 0.2);
      ctx.strokeStyle = t.contorno;
      ctx.strokeText(t.txt, t.x, y);
      ctx.fillStyle = t.cor;
      ctx.fillText(t.txt, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  return {
    add, estourar, subir, anel, texto, efeito, atualizar, desenhar, desenharTextos, desenharEfeitos, formas,
    /** sorteio da cena (com semente; o filme sai igual) */
    r,
    limpar() { ps = []; txts = []; efs = []; },
    get quantas() { return ps.length; },
  };
}

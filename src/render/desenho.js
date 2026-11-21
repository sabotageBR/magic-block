// Utilitarios de desenho: cores, cantos arredondados, cache de sprites (o brilho e o gradiente de
// cada bloco sao pintados uma vez por cor e tamanho, nunca a cada quadro) e icones feitos em codigo
// (coroa, recomecar, mao do tutorial, estrela, bomba).

export const TAU = Math.PI * 2;

/** @param {string} hex #rrggbb @returns {[number, number, number]} */
export function rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mistura duas cores (t = 0 a, 1 b). @param {string} a @param {string} b @param {number} t */
export function misturar(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** @param {string} c @param {number} t 0..1 */
export const clarear = (c, t) => misturar(c, '#ffffff', t);
/** @param {string} c @param {number} t 0..1 */
export const escurecer = (c, t) => misturar(c, '#000000', t);
/** @param {string} c @param {number} a */
export function alfa(c, a) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

/** Caminho de retangulo arredondado. @param {CanvasRenderingContext2D} ctx */
export function arredondado(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** @param {number} w @param {number} h */
export function novoCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });
  return /** @type {HTMLCanvasElement} */ (/** @type {unknown} */ (c));
}

/**
 * Cache de sprites por chave. `pintar(ctx, lado)` desenha com origem no canto e lado em px CSS; o
 * sprite guarda uma folga em volta (para brilho) e a densidade de pixels.
 */
export function criarCacheSprites() {
  /** @type {Map<string, { img: HTMLCanvasElement, folga: number }>} */
  const mapa = new Map();
  let dpr = 1;
  return {
    /** @param {number} v */
    definirDpr(v) {
      if (v !== dpr) { dpr = v; mapa.clear(); }
    },
    limpar() { mapa.clear(); },
    /**
     * @param {string} chave
     * @param {number} lado px CSS
     * @param {(ctx: CanvasRenderingContext2D, lado: number) => void} pintar
     * @param {number} [folgaRel] folga em volta, relativa ao lado
     */
    obter(chave, lado, pintar, folgaRel = 0.25) {
      const l = Math.max(2, Math.round(lado * 2) / 2);
      const k = chave + '@' + l;
      let s = mapa.get(k);
      if (!s) {
        const folga = Math.ceil(l * folgaRel);
        const px = Math.ceil((l + folga * 2) * dpr);
        const img = novoCanvas(px, px);
        const c = /** @type {CanvasRenderingContext2D} */ (img.getContext('2d'));
        c.scale(dpr, dpr);
        c.translate(folga, folga);
        pintar(c, l);
        s = { img, folga };
        mapa.set(k, s);
        if (mapa.size > 600) mapa.delete(mapa.keys().next().value);
      }
      return s;
    },
    /**
     * Desenha o sprite com o canto do bloco em (x, y) e lado `lado`.
     * @param {CanvasRenderingContext2D} ctx
     */
    desenhar(ctx, chave, x, y, lado, pintar, folgaRel = 0.25) {
      const s = this.obter(chave, lado, pintar, folgaRel);
      const l = Math.max(2, Math.round(lado * 2) / 2);
      const esc = lado / l;
      ctx.drawImage(s.img, x - s.folga * esc, y - s.folga * esc, (l + s.folga * 2) * esc, (l + s.folga * 2) * esc);
    },
  };
}

/** Estrela de 5 pontas centrada. @param {CanvasRenderingContext2D} ctx */
export function estrela(ctx, x, y, r, ri = r * 0.45, pontas = 5) {
  ctx.beginPath();
  for (let k = 0; k < pontas * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / pontas;
    const rr = k % 2 ? ri : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (k) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** Coroa do recorde. @param {CanvasRenderingContext2D} ctx */
export function coroa(ctx, x, y, w, cor) {
  const h = w * 0.72;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.28);
  ctx.lineTo(w * 0.27, h * 0.58);
  ctx.lineTo(w * 0.5, 0);
  ctx.lineTo(w * 0.73, h * 0.58);
  ctx.lineTo(w, h * 0.28);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Icone de recomecar (seta circular). @param {CanvasRenderingContext2D} ctx */
export function iconeRecomecar(ctx, x, y, r, cor) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI * 0.35, Math.PI * 1.35);
  ctx.stroke();
  const a = -Math.PI * 0.35;
  const px = x + Math.cos(a) * r;
  const py = y + Math.sin(a) * r;
  ctx.beginPath();
  ctx.moveTo(px + r * 0.45, py - r * 0.05);
  ctx.lineTo(px - r * 0.1, py - r * 0.55);
  ctx.lineTo(px - r * 0.15, py + r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Mao do tutorial (palma e indicador), ponta do dedo em (x, y). @param {CanvasRenderingContext2D} ctx */
export function mao(ctx, x, y, s, apertando = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  const k = apertando ? 0.92 : 1;
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineWidth = s * 0.07;
  ctx.strokeStyle = 'rgba(30,20,40,0.85)';
  ctx.fillStyle = '#ffffff';
  // indicador
  arredondado(ctx, -s * 0.11, 0, s * 0.22, s * 0.62, s * 0.11);
  ctx.fill();
  ctx.stroke();
  // palma com os outros dedos dobrados
  arredondado(ctx, -s * 0.13, s * 0.42, s * 0.52, s * 0.5, s * 0.16);
  ctx.fill();
  ctx.stroke();
  for (let k2 = 0; k2 < 3; k2++) {
    arredondado(ctx, s * (0.1 + k2 * 0.1), s * 0.36, s * 0.13, s * 0.22, s * 0.06);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Bomba com contador (por cima do bloco). @param {CanvasRenderingContext2D} ctx */
export function bomba(ctx, x, y, s, contador, fonte, pulso = 0) {
  const cx = x + s / 2;
  const cy = y + s * 0.54;
  const r = s * 0.3 * (1 + pulso * 0.08);
  ctx.save();
  ctx.fillStyle = '#1b1426';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = contador <= 2 ? '#ff4a4a' : '#ffd23f';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.stroke();
  // pavio
  ctx.strokeStyle = '#d9c7a0';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.5, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.4, cx + r * 0.4, cy - r * 1.55);
  ctx.stroke();
  ctx.fillStyle = contador <= 2 ? '#ff6a3d' : '#ffd23f';
  ctx.beginPath();
  ctx.arc(cx + r * 0.4, cy - r * 1.55, s * 0.06 * (1 + pulso * 0.6), 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(s * 0.36)}px ${fonte}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(contador), cx, cy + s * 0.02);
  ctx.restore();
}

/** Icone de sabor (para quem nao distingue as cores): coracao, gota, losango, estrela. @param {CanvasRenderingContext2D} ctx */
export function iconeSabor(ctx, cx, cy, r, sabor) {
  ctx.beginPath();
  switch (((sabor - 1) % 4 + 4) % 4) {
    case 0: // coracao
      ctx.moveTo(cx, cy + r * 0.85);
      ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.1, cx - r * 0.55, cy - r * 1.05, cx, cy - r * 0.35);
      ctx.bezierCurveTo(cx + r * 0.55, cy - r * 1.05, cx + r * 1.3, cy - r * 0.1, cx, cy + r * 0.85);
      break;
    case 1: // circulo
      ctx.arc(cx, cy, r * 0.72, 0, TAU);
      break;
    case 2: // losango
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.8, cy);
      break;
    default: // estrela
      estrela(ctx, cx, cy + r * 0.08, r, r * 0.45);
  }
  ctx.closePath();
}

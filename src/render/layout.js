// Geometria da tela (pura, em px CSS): HUD, tabuleiro e bandeja, em retrato ou paisagem.
// Retrato: HUD em cima, tabuleiro, bandeja embaixo. Paisagem/desktop: HUD a esquerda, tabuleiro ao
// centro, bandeja (3 vagas empilhadas) a direita.

/**
 * @typedef {object} Retangulo
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 */

/**
 * @typedef {object} Layout
 * @property {number} W
 * @property {number} H
 * @property {boolean} retrato
 * @property {number} n
 * @property {number} cs lado da casa no tabuleiro
 * @property {Retangulo} tab tabuleiro (so as casas)
 * @property {Retangulo} hud area do placar
 * @property {Retangulo[]} vagas 3 vagas da bandeja
 * @property {number} csBandeja lado da casa das pecas na bandeja
 * @property {Retangulo} orbe lugar do orbe/indicador da mecanica (e do Feitico)
 * @property {Retangulo|null} pausa botao de pausa (DOM) quando pedido; o HUD desenhado desvia dele
 * @property {number} margem
 */

/** @param {number} x @param {number} y @param {number} w @param {number} h @returns {Retangulo} */
const ret = (x, y, w, h) => ({ x, y, w, h });

/**
 * @param {number} W
 * @param {number} H
 * @param {number} n
 * @param {{ pausa?: boolean }} [op] pausa: reserva o canto do botao de pausa (jogo final)
 * @returns {Layout}
 */
export function calcularLayout(W, H, n, op = {}) {
  const retrato = H >= W * 1.12;
  const margem = Math.max(10, Math.min(W, H) * 0.035);
  if (retrato) {
    const hudH = Math.max(84, Math.min(150, H * 0.15));
    const bandH = Math.max(96, Math.min(W * 0.4, H * 0.21));
    const livreH = H - hudH - bandH - margem * 3;
    let lado = Math.min(W - margem * 2, livreH);
    const cs = Math.floor(lado / n);
    lado = cs * n;
    const total = hudH + lado + bandH + margem * 2;
    const y0 = Math.max(margem * 0.5, (H - total) / 2);
    const tab = ret(Math.round((W - lado) / 2), Math.round(y0 + hudH), lado, lado);
    const hud = ret(tab.x, y0, lado, hudH - margem * 0.6);
    const by = tab.y + lado + margem * 1.6;
    const vw = (W - margem * 2) / 3;
    const vagas = [0, 1, 2].map((k) => ret(margem + vw * k, by, vw, bandH));
    const csBandeja = Math.min(cs * 0.6, (vw * 0.94) / 5, (bandH * 0.9) / 5);
    const oR = Math.min(hud.h * 0.78, 74);
    let orbe = ret(hud.x + hud.w - oR, hud.y + (hud.h - oR) / 2, oR, oR);
    let pausa = null;
    if (op.pausa) {
      const b = Math.round(Math.max(40, Math.min(50, W * 0.12)));
      pausa = ret(hud.x + hud.w - b, Math.round(hud.y + hud.h * 0.42 - b / 2), b, b);
      const r2 = Math.min(oR, b * 1.3);
      orbe = ret(pausa.x - r2 - margem * 0.6, pausa.y + (b - r2) / 2, r2, r2);
    }
    return { W, H, retrato, n, cs, tab, hud, vagas, csBandeja, orbe, pausa, margem };
  }
  // paisagem
  let lado = Math.min(H - margem * 2, W * 0.56);
  const cs = Math.floor(lado / n);
  lado = cs * n;
  const tab = ret(Math.round((W - lado) / 2), Math.round((H - lado) / 2), lado, lado);
  const lateral = tab.x - margem * 2;
  let hud = ret(margem, tab.y, Math.max(80, lateral), lado);
  let pausa = null;
  if (op.pausa) {
    const b = Math.round(Math.max(40, Math.min(52, H * 0.09)));
    pausa = ret(margem, Math.max(margem * 0.6, tab.y), b, b);
    hud = ret(hud.x, pausa.y + b + margem * 0.6, hud.w, Math.max(60, tab.y + lado - (pausa.y + b + margem * 0.6)));
  }
  const vx = tab.x + lado + margem;
  const vw = Math.max(80, W - vx - margem);
  const vh = lado / 3;
  const vagas = [0, 1, 2].map((k) => ret(vx, tab.y + vh * k, vw, vh));
  const csBandeja = Math.min(cs * 0.6, (vw * 0.92) / 5, (vh * 0.9) / 5);
  const oR = Math.min(hud.w * 0.5, lado * 0.26, 96);
  const orbe = ret(hud.x + (hud.w - oR) / 2, tab.y + lado - oR - margem * 0.5, oR, oR);
  return { W, H, retrato, n, cs, tab, hud, vagas, csBandeja, orbe, pausa, margem };
}

/** Casa (gx, gy) sob o ponto, ou null. @param {Layout} L @param {number} x @param {number} y */
export function casaEm(L, x, y) {
  const gx = Math.floor((x - L.tab.x) / L.cs);
  const gy = Math.floor((y - L.tab.y) / L.cs);
  if (gx < 0 || gy < 0 || gx >= L.n || gy >= L.n) return null;
  return { gx, gy };
}

/** Vaga da bandeja sob o ponto (-1 nenhuma). @param {Layout} L @param {number} x @param {number} y */
export function vagaEm(L, x, y) {
  return L.vagas.findIndex((v) => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h);
}

/** @param {Retangulo} r @param {number} x @param {number} y @param {number} [folga] */
export function dentro(r, x, y, folga = 0) {
  return x >= r.x - folga && x < r.x + r.w + folga && y >= r.y - folga && y < r.y + r.h + folga;
}

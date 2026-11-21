// Cena: desenha a partida com o tema da vez. Comum a todos os temas: tabuleiro, blocos (sprites em
// cache), previa da jogada (fantasma e linhas que vao sumir acesas na cor da peca), bandeja, peca
// arrastada, animacoes (pouso, limpeza em onda a partir da peca, bandeja nova, volta da peca),
// sobreposicoes das mecanicas (bomba, estrela, aviso, sabor), HUD, tremida, mao do tutorial e fim.
//
// O tema (modelos/temas/*.js) so pinta: fundo, tabuleiro, bloco, efeitos de limpeza e o orbe.

import { calcularLayout } from './layout.js';
import { criarParticulas } from './particulas.js';
import {
  TAU, alfa, arredondado, bomba, clarear, coroa, criarCacheSprites, estrela, iconeRecomecar, iconeSabor, mao, novoCanvas,
} from './desenho.js';
import { limites } from '../jogo/formas.js';
import { ENTULHO, VAZIO } from '../jogo/tabuleiro.js';

/** Duracao da saida de um bloco limpo e atraso da onda por casa de distancia, s. */
const SAIDA = 0.3;
const ONDA = 0.035;

const suave = (u) => u * u * (3 - 2 * u);
const sair = (u) => 1 - Math.pow(1 - u, 3);

/**
 * @param {HTMLCanvasElement} canvas
 */
export function criarCena(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const sprites = criarCacheSprites();
  const fx = criarParticulas();
  /** @type {any} */
  let tema = null;
  /** @type {import('./layout.js').Layout} */
  let L = calcularLayout(390, 844, 8);
  let dpr = 1;
  let t = 0;
  /** camadas estaticas (fundo e tabuleiro) em cache */
  /** @type {{ chave: string, img: HTMLCanvasElement|null }} */
  const camFundo = { chave: '', img: null };
  /** @type {{ chave: string, img: HTMLCanvasElement|null }} */
  const camTab = { chave: '', img: null };

  // animacoes
  /** @type {Map<number, number>} casa -> t do pouso */
  const pousos = new Map();
  /** @type {{ i: number, cor: number, t0: number, gerou: boolean, grupo: any }[]} */
  let saindo = [];
  /** @type {number[]} t de entrada de cada vaga */
  let entradaVaga = [-9, -9, -9];
  /** @type {{ slot: number, x: number, y: number, t0: number } | null} */
  let volta = null;
  let tremida = { t0: -9, forca: 0 };
  let placar = 0;
  let fimT0 = -1;
  let manaVista = 0;
  /** @type {{ x: number, y: number, w: number, h: number } | null} */
  let botaoRecomecar = null;
  /** textos que a cena escreve (o jogo troca pelo idioma) */
  let rotulos = { combo: 'COMBO', puro: 'PURO', perfeito: 'PERFEITO!' };

  /** @param {number} i */
  const casaXY = (i) => ({ x: L.tab.x + (i % L.n) * L.cs, y: L.tab.y + Math.floor(i / L.n) * L.cs });
  /** @param {number} cor */
  const hexCor = (cor) => (cor === ENTULHO ? tema.entulho : tema.cores[(cor - 1) % tema.cores.length]);

  /** Desenha um bloco da cor (indice 1..K ou ENTULHO) com canto em (x, y). */
  function bloco(x, y, s, cor) {
    if (cor === ENTULHO) {
      sprites.desenhar(ctx, tema.id + ':entulho', x, y, s, (c, l) => (tema.pintarEntulho ? tema.pintarEntulho(c, l) : tema.pintarBloco(c, l, tema.entulho, -1)), tema.folga);
      return;
    }
    const hex = hexCor(cor);
    sprites.desenhar(ctx, tema.id + ':' + hex, x, y, s, (c, l) => tema.pintarBloco(c, l, hex, cor), tema.folga);
  }

  /** Sobreposicoes da mecanica num bloco (bomba, sabor). */
  function sobreposicao(x, y, s, cor, op = {}) {
    if (op.sabores && cor > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, s * 0.04);
      iconeSabor(ctx, x + s / 2, y + s / 2, s * 0.2, cor);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (op.bomba) bomba(ctx, x, y, s, op.bomba, tema.fonte, op.pulso || 0);
  }

  /** @param {number} W @param {number} H @param {number} d @param {number} n @param {{ pausa?: boolean }} [op] */
  function redimensionar(W, H, d, n, op = {}) {
    dpr = d;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    L = calcularLayout(W, H, n, op);
    sprites.definirDpr(dpr);
    camFundo.chave = '';
    camTab.chave = '';
  }

  /** @param {any} novo */
  function definirTema(novo) {
    tema = novo;
    sprites.limpar();
    camFundo.chave = '';
    camTab.chave = '';
    fx.limpar();
  }

  /** Camada estatica em cache (pintada em px de tela). */
  function camada(cam, chave, pintar) {
    if (cam.chave !== chave || !cam.img) {
      const img = novoCanvas(canvas.width, canvas.height);
      const c = /** @type {CanvasRenderingContext2D} */ (img.getContext('2d'));
      c.scale(dpr, dpr);
      pintar(c);
      cam.img = img;
      cam.chave = chave;
    }
    ctx.drawImage(/** @type {HTMLCanvasElement} */ (cam.img), 0, 0, L.W, L.H);
  }

  /** Recomeca as animacoes (partida nova). */
  function reiniciar() {
    pousos.clear();
    saindo = [];
    entradaVaga = [t, t + 0.06, t + 0.12];
    volta = null;
    placar = 0;
    fimT0 = -1;
    manaVista = 0;
    fx.limpar();
  }

  /**
   * Eventos da partida viram animacao e efeito.
   * @param {any[]} evs
   */
  function eventos(evs) {
    for (const e of evs) {
      if (e.tipo === 'colocou') {
        for (const i of e.cels) pousos.set(i, t);
        if (tema.colocar) {
          const cs = e.cels.map((i) => ({ ...casaXY(i), s: L.cs }));
          tema.colocar(fx, cs, hexCor(e.cor), L);
        }
      } else if (e.tipo === 'limpou') {
        const oi = e.origem >= 0 ? e.origem : Math.floor((L.n * L.n) / 2);
        const ox = oi % L.n;
        const oy = Math.floor(oi / L.n);
        for (const c of e.cels) {
          const d = Math.hypot((c.i % L.n) - ox, Math.floor(c.i / L.n) - oy);
          const grupo = e.grupos.find((g) => g.cels.includes(c.i));
          saindo.push({ i: c.i, cor: c.cor, t0: t + d * ONDA, gerou: false, grupo });
        }
        for (const g of e.grupos) if (tema.limparGrupo) tema.limparGrupo(fx, L, g, t, g.pura);
        const centro = casaXY(oi);
        if (e.pontos > 0) {
          const k = Math.min(1, e.k / 3);
          fx.texto(centro.x + L.cs / 2, centro.y, '+' + e.pontos, tema.hud.destaque, { tam: L.cs * (0.7 + k * 0.35), contorno: tema.hud.contorno });
          tremer(Math.min(10, 2 + e.k * 2 + e.seq * 0.6));
        }
        if (e.seq >= 2) {
          const g = Math.min(1, (e.seq - 2) / 6);
          fx.texto(L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h * 0.36, `${rotulos.combo} x${e.seq}`, tema.hud.combo || tema.hud.destaque, { tam: L.cs * (0.95 + g * 0.45), contorno: tema.hud.contorno, vida: 1.1 + g * 0.3, sobe: 30 });
          if (tema.combo && e.seq >= 3) tema.combo(fx, L, e.seq, t);
        }
        if (e.puras) fx.texto(L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h * 0.55, `${rotulos.puro} x3`, '#ffffff', { tam: L.cs * 0.85, contorno: tema.hud.contorno, vida: 1.2 });
        if (e.k >= 2 && e.pontos > 0 && tema.multi) tema.multi(fx, L, e.k, t);
        if (e.dobro) fx.texto(centro.x + L.cs / 2, centro.y - L.cs * 0.8, 'x2', '#ffe066', { tam: L.cs * 0.7, contorno: tema.hud.contorno });
      } else if (e.tipo === 'magia') {
        const p = casaXY(e.i);
        for (const c of e.cels) {
          const d = Math.max(Math.abs((c.i % L.n) - (e.i % L.n)), Math.abs(Math.floor(c.i / L.n) - Math.floor(e.i / L.n)));
          saindo.push({ i: c.i, cor: c.cor, t0: t + d * 0.045, gerou: false, grupo: null });
        }
        if (tema.magia) tema.magia(fx, L, e.i, t);
        else fx.anel(p.x + L.cs / 2, p.y + L.cs / 2, '#ffffff', L.cs * 3, 0.6);
        if (e.pontos) fx.texto(p.x + L.cs / 2, p.y, '+' + e.pontos, tema.hud.destaque, { tam: L.cs * 0.8, contorno: tema.hud.contorno });
        tremer(7);
      } else if (e.tipo === 'explodiu') {
        const p = casaXY(e.i);
        const cx = p.x + L.cs / 2;
        const cy = p.y + L.cs / 2;
        fx.estourar(cx, cy, ['#ffb03b', '#ff5e3a', '#ffe48a', '#3a3040'], 30, { forca: 1.5, tam: L.cs * 0.22, forma: ['c', 'q'] });
        fx.anel(cx, cy, '#ffcf5a', L.cs * 3.2, 0.5);
        for (const i of e.cels) pousos.set(i, t);
        tremer(12);
      } else if (e.tipo === 'coletou') {
        const p = casaXY(e.i);
        fx.estourar(p.x + L.cs / 2, p.y + L.cs / 2, ['#ffe066', '#fff6c2', '#ffb703'], 16, { forma: 'estrela', tam: L.cs * 0.28, g: 120, forca: 1.1 });
        fx.anel(p.x + L.cs / 2, p.y + L.cs / 2, '#ffe066', L.cs * 2, 0.55);
      } else if (e.tipo === 'estrela') {
        const p = casaXY(e.i);
        fx.estourar(p.x + L.cs / 2, p.y + L.cs / 2, ['#fff6c2', '#ffe066'], 10, { forma: 'brilho', tam: L.cs * 0.25, g: 0, forca: 0.6 });
      } else if (e.tipo === 'feitico') {
        const o = L.orbe;
        fx.anel(o.x + o.w / 2, o.y + o.h / 2, '#ffffff', o.w * 1.4, 0.7);
        fx.estourar(o.x + o.w / 2, o.y + o.h / 2, tema.cores, 18, { forma: 'brilho', tam: o.w * 0.14, g: 0, forca: 0.8 });
      } else if (e.tipo === 'perfeito') {
        if (tema.perfeito) tema.perfeito(fx, L, t);
        fx.texto(L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h * 0.5, rotulos.perfeito, '#ffe066', { tam: L.cs * 1.15, contorno: tema.hud.contorno, vida: 1.6, sobe: 20 });
        fx.texto(L.tab.x + L.tab.w / 2, L.tab.y + L.tab.h * 0.5 + L.cs, '+' + e.pontos, '#ffffff', { tam: L.cs * 0.8, contorno: tema.hud.contorno, vida: 1.6, sobe: 20 });
        tremer(12);
      } else if (e.tipo === 'reviveu') {
        for (const c of e.cels) {
          const d = Math.hypot((c.i % L.n) - (L.n - 1) / 2, Math.floor(c.i / L.n) - (L.n - 1) / 2);
          saindo.push({ i: c.i, cor: c.cor, t0: t + 0.1 + d * 0.05, gerou: false, grupo: null });
        }
        if (tema.perfeito) tema.perfeito(fx, L, t);
        fimT0 = -1;
      } else if (e.tipo === 'aviso') {
        const p = casaXY(e.i);
        fx.anel(p.x + L.cs / 2, p.y + L.cs / 2, '#ffe066', L.cs * 1.4, 0.6);
      } else if (e.tipo === 'bandeja') {
        entradaVaga = [t, t + 0.07, t + 0.14];
      } else if (e.tipo === 'fim') {
        fimT0 = t + 0.6;
      }
    }
  }

  /** @param {number} forca */
  function tremer(forca) {
    if (forca >= tremida.forca * Math.max(0, 1 - (t - tremida.t0) / 0.3)) tremida = { t0: t, forca };
  }

  /** A peca do slot voltou para a bandeja (soltou fora). */
  function voltar(slot, x, y) { volta = { slot, x, y, t0: t }; }

  /** @param {number} dt */
  function atualizar(dt) {
    t += dt;
    fx.atualizar(dt);
    for (const s of saindo) {
      if (!s.gerou && t >= s.t0) {
        s.gerou = true;
        const p = casaXY(s.i);
        if (tema.limpar) tema.limpar(fx, { x: p.x, y: p.y, s: L.cs, cor: hexCor(s.cor), k: s.cor, grupo: s.grupo, L });
      }
    }
    saindo = saindo.filter((s) => t < s.t0 + SAIDA);
    for (const [i, t0] of pousos) if (t - t0 > 0.5) pousos.delete(i);
  }

  /** Centro da vaga k. */
  function centroVaga(k) {
    const v = L.vagas[k];
    return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
  }

  /** Desenha uma peca com centro (cx, cy) e casa de lado s. */
  function peca(p, cx, cy, s, op = {}) {
    const { w, h } = limites(p.cels);
    const x0 = cx - (w * s) / 2;
    const y0 = cy - (h * s) / 2;
    p.cels.forEach(([x, y], k) => {
      bloco(x0 + x * s, y0 + y * s, s, p.cor);
      if (op.sabores || (k === p.bomba)) sobreposicao(x0 + x * s, y0 + y * s, s, p.cor, { sabores: op.sabores, bomba: k === p.bomba ? p.contador : 0 });
    });
  }

  /** Desenha o HUD (placar, recorde, sequencia e indicador da mecanica). */
  function hud(E, S) {
    const H = L.hud;
    const f = tema.fonte;
    const cor = tema.hud;
    placar += (E.pontos - placar) * Math.min(1, 0.18);
    if (Math.abs(E.pontos - placar) < 0.5) placar = E.pontos;
    const recorde = Math.max(S.recorde || 0, E.pontos);
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (L.retrato) {
      const tamP = Math.min(H.h * 0.46, L.W * 0.13);
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(tamP)}px ${f}`;
      ctx.lineWidth = tamP * 0.14;
      ctx.strokeStyle = cor.contorno;
      ctx.strokeText(String(Math.round(placar)), L.W / 2, H.y + H.h * 0.42);
      ctx.fillStyle = cor.texto;
      ctx.fillText(String(Math.round(placar)), L.W / 2, H.y + H.h * 0.42);
      // recorde
      const tamR = Math.max(13, tamP * 0.36);
      coroa(ctx, H.x + 2, H.y + H.h * 0.42 - tamR * 0.42, tamR * 1.1, cor.coroa || '#ffd23f');
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(tamR)}px ${f}`;
      ctx.lineWidth = tamR * 0.24;
      ctx.strokeStyle = cor.contorno;
      ctx.strokeText(String(recorde), H.x + tamR * 1.45, H.y + H.h * 0.42);
      ctx.fillStyle = cor.suave;
      ctx.fillText(String(recorde), H.x + tamR * 1.45, H.y + H.h * 0.42);
      if (E.seq >= 2) {
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(tamR * 0.95)}px ${f}`;
        ctx.lineWidth = tamR * 0.22;
        ctx.strokeStyle = cor.contorno;
        ctx.strokeText(`${rotulos.combo} x${E.seq}`, L.W / 2, H.y + H.h * 0.86);
        ctx.fillStyle = cor.combo || cor.destaque;
        ctx.fillText(`${rotulos.combo} x${E.seq}`, L.W / 2, H.y + H.h * 0.86);
      }
    } else {
      const tamP = Math.min(H.w * 0.3, L.tab.h * 0.12);
      ctx.textAlign = 'center';
      const cx = H.x + H.w / 2;
      const tamR = Math.max(13, tamP * 0.42);
      coroa(ctx, cx - tamR * 1.9, H.y + tamR * 0.25, tamR * 1.1, cor.coroa || '#ffd23f');
      ctx.font = `700 ${Math.round(tamR)}px ${f}`;
      ctx.textAlign = 'left';
      ctx.lineWidth = tamR * 0.24;
      ctx.strokeStyle = cor.contorno;
      ctx.strokeText(String(recorde), cx - tamR * 0.5, H.y + tamR * 0.65);
      ctx.fillStyle = cor.suave;
      ctx.fillText(String(recorde), cx - tamR * 0.5, H.y + tamR * 0.65);
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(tamP)}px ${f}`;
      ctx.lineWidth = tamP * 0.14;
      ctx.strokeStyle = cor.contorno;
      ctx.strokeText(String(Math.round(placar)), cx, H.y + tamR * 1.6 + tamP * 0.6);
      ctx.fillStyle = cor.texto;
      ctx.fillText(String(Math.round(placar)), cx, H.y + tamR * 1.6 + tamP * 0.6);
      if (E.seq >= 2) {
        ctx.font = `700 ${Math.round(tamR * 0.95)}px ${f}`;
        ctx.lineWidth = tamR * 0.22;
        ctx.strokeStyle = cor.contorno;
        ctx.strokeText(`${rotulos.combo} x${E.seq}`, cx, H.y + tamR * 1.6 + tamP * 1.35);
        ctx.fillStyle = cor.combo || cor.destaque;
        ctx.fillText(`${rotulos.combo} x${E.seq}`, cx, H.y + tamR * 1.6 + tamP * 1.35);
      }
    }
    indicador(E, S);
  }

  /** Orbe de mana, estrela do x2 ou nada (no canto do HUD). */
  function indicador(E, S) {
    const o = L.orbe;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    if (E.regras.mana) {
      manaVista += (E.mana - manaVista) * 0.12;
      if (E.feitico) manaVista = 1;
      const arrastandoFeitico = S.arrasto && S.arrasto.slot === 3;
      if (tema.orbe) tema.orbe(ctx, o, manaVista, E.feitico && !arrastandoFeitico, t);
      else orbePadrao(o, manaVista, E.feitico && !arrastandoFeitico);
    } else if (E.regras.estrelas && E.dobro > 0) {
      ctx.save();
      const r = o.w * 0.34 * (1 + Math.sin(t * 6) * 0.05);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = tema.hud.contorno;
      ctx.lineWidth = 3;
      estrela(ctx, cx, cy, r, r * 0.48);
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = '#5a3a00';
      ctx.font = `700 ${Math.round(r * 0.62)}px ${tema.fonte}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('x2', cx, cy + r * 0.08);
      // limpezas restantes
      for (let k = 0; k < E.dobro; k++) {
        ctx.fillStyle = tema.hud.texto;
        ctx.beginPath();
        ctx.arc(cx - (E.dobro - 1) * 6 + k * 12, cy + r * 1.25, 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function orbePadrao(o, mana, pronto) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    const r = o.w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = pronto ? '#c9a7ff' : '#7b5cff';
    ctx.fillRect(o.x, o.y + o.h * (1 - mana), o.w, o.h * mana);
    ctx.restore();
  }

  /** O tutorial: mao arrastando a peca da vaga ate o alvo, em laco. */
  function tutorial(E, dica) {
    const p = E.bandeja[dica.slot];
    if (!p) return;
    const ciclo = 1.9;
    const u = (t % ciclo) / ciclo;
    const de = centroVaga(dica.slot);
    const { w, h } = limites(p.cels);
    const para = { x: L.tab.x + (dica.gx + w / 2) * L.cs, y: L.tab.y + (dica.gy + h / 2) * L.cs };
    const k = u < 0.18 ? 0 : u > 0.78 ? 1 : suave((u - 0.18) / 0.6);
    const x = de.x + (para.x - de.x) * k;
    const y = de.y + (para.y - de.y) * k;
    ctx.save();
    ctx.globalAlpha = u > 0.88 ? (1 - u) / 0.12 : Math.min(1, u / 0.08);
    if (k > 0) {
      ctx.globalAlpha *= 0.55;
      peca(p, x, y, L.csBandeja + (L.cs - L.csBandeja) * k);
      ctx.globalAlpha /= 0.55;
    }
    mao(ctx, x + L.cs * 0.2, y + L.cs * 0.25, L.cs * 1.1, u > 0.12 && u < 0.8);
    ctx.restore();
  }

  /**
   * Quadro completo.
   * @param {any} E partida
   * @param {any} S estado da tela: { arrasto, recorde, dica, tutorial, auto }
   */
  function desenhar(E, S) {
    const W = L.W;
    const H = L.H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fundo (camada estatica + animada do tema)
    camada(camFundo, `${tema.id}|${W}x${H}|${dpr}`, (c) => tema.fundo(c, L));
    if (tema.fundoVivo) tema.fundoVivo(ctx, L, t);

    // tremida
    const ut = (t - tremida.t0) / 0.3;
    ctx.save();
    if (ut < 1) {
      const a = tremida.forca * (1 - ut) * (1 - ut);
      ctx.translate(Math.sin(t * 91) * a * 0.6, Math.cos(t * 77) * a * 0.6);
    }

    camada(camTab, `${tema.id}|${W}x${H}|${dpr}|${L.n}|${E.regras.quadrantes ? 1 : 0}`, (c) => {
      tema.tabuleiro(c, L, { quadrantes: !!E.regras.quadrantes });
      if (E.regras.quadrantes && !tema.desenhaQuadrantes) quadrantes(c);
    });
    fx.desenharEfeitos(ctx, false);

    const n = L.n;
    const cs = L.cs;
    const T = E.t;
    const a = S.arrasto;
    const previa = a && a.previa ? a.previa : null;
    const corPrevia = a && a.peca ? a.peca.cor : 0;
    const pulso = 0.5 + 0.5 * Math.sin(t * 9);

    // estrelas e avisos nas casas vazias
    for (let i = 0; i < n * n; i++) {
      const { x, y } = casaXY(i);
      if (T.estrela[i] && T.cor[i] === VAZIO) {
        const r = cs * 0.3 * (1 + Math.sin(t * 4 + i) * 0.08);
        ctx.save();
        const halo = ctx.createRadialGradient(x + cs / 2, y + cs / 2, r * 0.3, x + cs / 2, y + cs / 2, r * 1.7);
        halo.addColorStop(0, alfa('#ffe066', 0.45));
        halo.addColorStop(1, alfa('#ffe066', 0));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x + cs / 2, y + cs / 2, r * 1.7, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffd23f';
        estrela(ctx, x + cs / 2, y + cs / 2, r, r * 0.47);
        ctx.fill();
        ctx.restore();
      }
      if (E.aviso === i) {
        ctx.save();
        ctx.strokeStyle = alfa('#ffe066', 0.5 + pulso * 0.4);
        ctx.lineWidth = Math.max(1.5, cs * 0.05);
        ctx.setLineDash([cs * 0.12, cs * 0.1]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.arc(x + cs / 2, y + cs / 2, cs * 0.34, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }

    // blocos
    for (let i = 0; i < n * n; i++) {
      const c = T.cor[i];
      if (c === VAZIO) continue;
      let { x, y } = casaXY(i);
      let s = cs;
      const tp = pousos.get(i);
      if (tp !== undefined) {
        const u = (t - tp) / 0.32;
        if (u < 1) {
          const amp = tema.pouso || 0.12;
          const k = 1 + Math.sin(u * Math.PI) * amp * (1 - u);
          const ky = 1 - Math.sin(u * Math.PI) * amp * 0.6 * (1 - u);
          ctx.save();
          ctx.translate(x + cs / 2, y + cs);
          ctx.scale(k, ky);
          ctx.translate(-(x + cs / 2), -(y + cs));
        }
        if (u < 1) {
          bloco(x, y, s, previa && previa.has(i) ? corPrevia : c);
          ctx.restore();
          sobreposicaoCasa(E, i, x, y, s, c);
          continue;
        }
      }
      if (previa && previa.has(i)) {
        bloco(x, y, s, corPrevia);
        ctx.fillStyle = `rgba(255,255,255,${0.12 + pulso * 0.22})`;
        arredondado(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.18);
        ctx.fill();
      } else bloco(x, y, s, c);
      sobreposicaoCasa(E, i, x, y, s, c);
    }

    // blocos saindo (limpeza)
    for (const sd of saindo) {
      const { x, y } = casaXY(sd.i);
      const u = (t - sd.t0) / SAIDA;
      if (u < 0) { bloco(x, y, cs, sd.cor); continue; }
      const k = sair(Math.min(1, u));
      ctx.save();
      ctx.translate(x + cs / 2, y + cs / 2);
      const estilo = tema.saida || 'encolhe';
      if (estilo === 'cresce') {
        ctx.globalAlpha = 1 - k;
        ctx.scale(1 + k * 0.35, 1 + k * 0.35);
      } else if (estilo === 'afunda') {
        ctx.globalAlpha = 1 - k;
        ctx.translate(0, k * cs * 0.18);
        ctx.scale(1 - k * 0.5, 1 - k * 0.5);
      } else {
        ctx.rotate(k * 0.6);
        ctx.scale(1 - k, 1 - k);
      }
      bloco(-cs / 2, -cs / 2, cs, sd.cor);
      if (u < 0.35) {
        ctx.globalAlpha = (0.35 - u) / 0.35;
        ctx.fillStyle = '#ffffff';
        arredondado(ctx, -cs / 2, -cs / 2, cs, cs, cs * 0.2);
        ctx.fill();
      }
      ctx.restore();
    }

    // fantasma da peca no alvo
    if (a && a.alvo && a.peca) {
      const p = a.peca;
      ctx.save();
      for (const [cx, cy] of p.cels) {
        const x = L.tab.x + (a.alvo.gx + cx) * cs;
        const y = L.tab.y + (a.alvo.gy + cy) * cs;
        ctx.globalAlpha = previa && previa.size ? 0.85 : 0.42;
        bloco(x, y, cs, p.cor);
      }
      ctx.restore();
    }
    // Feitico: linha e coluna acesas
    if (a && a.slot === 3 && a.alvo) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.15 + pulso * 0.2})`;
      ctx.fillRect(L.tab.x, L.tab.y + a.alvo.gy * cs, L.tab.w, cs);
      ctx.fillRect(L.tab.x + a.alvo.gx * cs, L.tab.y, cs, L.tab.h);
      ctx.restore();
    }

    fx.desenhar(ctx);
    fx.desenharEfeitos(ctx, true);
    ctx.restore();

    // bandeja
    for (let k = 0; k < 3; k++) {
      const p = E.bandeja[k];
      if (!p || (a && a.slot === k)) continue;
      const c = centroVaga(k);
      let cx = c.x;
      let cy = c.y;
      const ue = (t - entradaVaga[k]) / 0.32;
      if (ue < 1) {
        const kk = sair(Math.max(0, ue));
        if (L.retrato) cy += (1 - kk) * L.vagas[k].h * 0.9;
        else cx += (1 - kk) * L.vagas[k].w;
        ctx.globalAlpha = Math.max(0, Math.min(1, ue * 3));
      }
      let s = L.csBandeja;
      if (volta && volta.slot === k) {
        const uv = (t - volta.t0) / 0.2;
        if (uv < 1) {
          const kk = sair(uv);
          cx = volta.x + (cx - volta.x) * kk;
          cy = volta.y + (cy - volta.y) * kk;
          s = cs + (L.csBandeja - cs) * kk;
        } else volta = null;
      }
      const cabe = S.cabe ? S.cabe[k] : true;
      if (!cabe) ctx.globalAlpha *= 0.32;
      peca(p, cx, cy, s, { sabores: !!E.regras.sabores });
      ctx.globalAlpha = 1;
      if (E.regras.girar && cabe !== undefined) {
        // seta de girar embaixo da peca
        const { h } = limites(p.cels);
        const gy = cy + (h * s) / 2 + Math.max(10, s * 0.75);
        ctx.save();
        ctx.globalAlpha = 0.75;
        iconeRecomecar(ctx, cx, Math.min(gy, L.vagas[k].y + L.vagas[k].h - 8), Math.max(6, s * 0.38), tema.hud.suave);
        ctx.restore();
      }
    }

    if (!S.semHud) hud(E, S);

    // peca arrastada
    if (a && a.peca) {
      const s = L.csBandeja + (cs - L.csBandeja) * Math.min(1, a.cresce);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 0;
      peca(a.peca, a.x, a.y, s, { sabores: !!E.regras.sabores });
      ctx.restore();
    } else if (a && a.slot === 3) {
      // Feitico na mao
      const r = cs * 0.55;
      if (tema.orbe) tema.orbe(ctx, { x: a.x - r, y: a.y - r, w: r * 2, h: r * 2 }, 1, true, t);
      else orbePadrao({ x: a.x - r, y: a.y - r, w: r * 2, h: r * 2 }, 1, true);
    }

    if (S.tutorial && S.dica && !a) tutorial(E, S.dica);

    fx.desenharTextos(ctx, tema.fonte);

    // fim de jogo
    botaoRecomecar = null;
    if (E.fim && fimT0 >= 0 && t >= fimT0) {
      if (S.fimDom) {
        // o painel do fim e do jogo (DOM): aqui so escurece a tela
        ctx.fillStyle = `rgba(3,4,15,${0.55 * Math.min(1, (t - fimT0) / 0.35)})`;
        ctx.fillRect(0, 0, L.W, L.H);
      } else fim(E, S);
    }
  }

  /** Divisorias dos quadrantes 3x3 para temas que nao desenham as proprias. @param {CanvasRenderingContext2D} c */
  function quadrantes(c) {
    c.save();
    c.strokeStyle = alfa(tema.hud.suave.startsWith('#') ? tema.hud.suave : '#ffffff', 0.55);
    c.lineWidth = Math.max(2, L.cs * 0.06);
    c.lineCap = 'round';
    for (let k = 3; k < L.n; k += 3) {
      c.beginPath();
      c.moveTo(L.tab.x + k * L.cs, L.tab.y + 4);
      c.lineTo(L.tab.x + k * L.cs, L.tab.y + L.tab.h - 4);
      c.moveTo(L.tab.x + 4, L.tab.y + k * L.cs);
      c.lineTo(L.tab.x + L.tab.w - 4, L.tab.y + k * L.cs);
      c.stroke();
    }
    c.restore();
  }

  /** Sobreposicao numa casa do tabuleiro (bomba, estrela por baixo, sabor). */
  function sobreposicaoCasa(E, i, x, y, s, c) {
    const T = E.t;
    if (T.estrela[i]) {
      ctx.save();
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = 'rgba(80,50,0,0.6)';
      ctx.lineWidth = 1.5;
      const r = s * 0.2 * (1 + Math.sin(t * 5 + i) * 0.1);
      estrela(ctx, x + s / 2, y + s / 2, r, r * 0.47);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (E.regras.sabores || T.bomba[i] > 0) {
      sobreposicao(x, y, s, c, { sabores: !!E.regras.sabores, bomba: T.bomba[i], pulso: T.bomba[i] <= 2 ? 0.5 + 0.5 * Math.sin(t * 14) : 0 });
    }
  }

  /** Painel de fim de jogo: pontos, recorde e o botao de recomecar. */
  function fim(E, S) {
    const u = Math.min(1, (t - fimT0) / 0.35);
    const k = sair(u);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.45 * k})`;
    ctx.fillRect(0, 0, L.W, L.H);
    const w = Math.min(L.W * 0.82, 340);
    const h = w * 0.86;
    const x = (L.W - w) / 2;
    const y = (L.H - h) / 2 + (1 - k) * 40;
    ctx.globalAlpha = k;
    const painel = tema.painel || { fundo: '#2b1d4a', borda: '#ffffff', texto: '#ffffff' };
    arredondado(ctx, x, y, w, h, w * 0.08);
    ctx.fillStyle = painel.fundo;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = painel.borda;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = painel.texto;
    ctx.font = `700 ${Math.round(w * 0.2)}px ${tema.fonte}`;
    ctx.fillText(String(E.pontos), L.W / 2, y + h * 0.27);
    const rec = Math.max(S.recorde || 0, E.pontos);
    const novo = E.pontos > 0 && E.pontos >= rec && S.recordeNovo;
    coroa(ctx, L.W / 2 - w * 0.2, y + h * 0.47 - w * 0.04, w * 0.09, '#ffd23f');
    ctx.font = `700 ${Math.round(w * 0.085)}px ${tema.fonte}`;
    ctx.textAlign = 'left';
    ctx.fillText(String(rec), L.W / 2 - w * 0.08, y + h * 0.48);
    if (novo) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23f';
      ctx.font = `700 ${Math.round(w * 0.07)}px ${tema.fonte}`;
      ctx.fillText('RECORDE!', L.W / 2, y + h * 0.6);
    }
    // botao
    const br = w * 0.13;
    const bx = L.W / 2;
    const by = y + h * 0.8;
    ctx.fillStyle = painel.botao || '#35d07f';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
    iconeRecomecar(ctx, bx, by, br * 0.5, '#ffffff');
    ctx.restore();
    botaoRecomecar = { x: bx - br * 1.4, y: by - br * 1.4, w: br * 2.8, h: br * 2.8 };
  }

  return {
    redimensionar, definirTema, eventos, atualizar, desenhar, reiniciar, voltar, tremer, fx,
    /** placar sem contar ate o valor (partida pre-jogada) @param {number} v */
    fixarPlacar(v) { placar = v; },
    /** @param {{ combo?: string, puro?: string, perfeito?: string }} r */
    definirRotulos(r) { rotulos = { ...rotulos, ...r }; },
    /** o fim ja comecou a aparecer (painel do jogo pode entrar) */
    get fimComecou() { return fimT0 >= 0 && t >= fimT0; },
    get L() { return L; },
    get t() { return t; },
    get tema() { return tema; },
    get botaoRecomecar() { return botaoRecomecar; },
    /** fim ja apareceu na tela */
    get fimVisivel() { return fimT0 >= 0 && t >= fimT0 + 0.2; },
    centroVaga,
    clarear,
  };
}

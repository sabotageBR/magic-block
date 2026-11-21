// Prototipo jogavel dos modelos: tema (visual) x mecanica, com o nucleo de src/jogo e a cena de
// src/render. Parametros no hash (ou na query):
//   tema=1..6     visual (padrao 1)
//   mec=0..6      mecanica (padrao: a do tema; 0 = classico, sem extra)
//   semente=N     partida deterministica
//   auto          o bot joga sozinho (ruido=N deixa o bot pior)
//   pre=N         comeca com N jogadas do bot ja feitas
//   fixo          cena parada para print: pre=12 e uma peca no ar com a previa acesa
//   filme=fps     gera os quadros do GIF (dur=ms, larg=px) em <pre id="filme">, sem relogio real
//   limpo         esconde a barra de cima
//   mana=0..1     comeca com o orbe nesse nivel (para mostrar o Feitico logo)
// Teclas: 1..6 tema, R recomeca, A liga/desliga o bot.

import { TEMAS, NOMES_MEC } from './temas/index.js';
import { criarCena } from '../src/render/cena.js';
import { casaEm, dentro, vagaEm } from '../src/render/layout.js';
import { colocar, criarPartida, girar, slotCabe, usarFeitico } from '../src/jogo/partida.js';
import { MECANICAS } from '../src/jogo/regras.js';
import { previa } from '../src/jogo/tabuleiro.js';
import { limites } from '../src/jogo/formas.js';
import { aplicarJogada, escolherJogada } from '../src/jogo/bot.js';
import { criarRng } from '../src/core/rng.js';
import { PASSO, criarLaco } from '../src/core/laco.js';
import { criarAudio } from '../src/core/audio.js';
import { criarArmazem } from '../src/core/armazenamento.js';
import { criarSons } from '../src/som/sons.js';

const ARRASTO_MIN = 8;
const VOO_BOT = 0.42;

// ------------------------------------------------------------------ parametros
function lerParametros() {
  // __magicblockPadrao: parametros fixos das paginas jogar-N.html do Artifact (sem hash nem query)
  const q = new URLSearchParams(location.hash.slice(1) || location.search.slice(1) || globalThis.__magicblockPadrao || '');
  const num = (k, d) => (q.has(k) && q.get(k) !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const fixo = q.has('fixo');
  const filme = num('filme', 0);
  return {
    tema: Math.max(1, Math.min(TEMAS.length, num('tema', 1))),
    mec: q.has('mec') ? Math.max(0, Math.min(MECANICAS.length - 1, num('mec', 0))) : null,
    semente: num('semente', null),
    auto: q.has('auto') || filme > 0,
    ruido: num('ruido', 0),
    pre: num('pre', fixo ? 12 : 0),
    fixo,
    filme,
    dur: num('dur', 8000),
    larg: num('larg', 360),
    limpo: q.has('limpo') || fixo || filme > 0,
    mana: num('mana', -1),
  };
}
const P = lerParametros();

// ------------------------------------------------------------------ estado
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('tela'));
const palco = /** @type {HTMLElement} */ (document.getElementById('palco'));
const barra = /** @type {HTMLElement} */ (document.getElementById('barra'));
const cena = criarCena(canvas);
const audio = criarAudio();
const armazem = criarArmazem();
if (P.limpo) document.body.classList.add('limpo');

let temaIdx = P.tema - 1;
let mec = P.mec ?? TEMAS[temaIdx].mec;
let semente = P.semente ?? (Date.now() % 1000003);
const rngBot = criarRng((P.semente ?? 7) * 31 + 5);
/** @type {any} */
let SONS = {};
/** @type {import('../src/jogo/partida.js').Partida} */
let E;
/** @type {any} */
const S = { arrasto: null, recorde: 0, recordeNovo: false, dica: null, tutorial: !P.auto && !P.fixo, cabe: [true, true, true] };
let auto = P.auto;
/** @type {any} */
let bot = null;
let esperaBot = 0.6;
let esperaFim = 0;

/** @param {string} nome @param {any} [p] */
function tocar(nome, p = {}) {
  const r = SONS[nome];
  if (r) audio.tocarReceita(r, p, { chave: nome, max: 3 });
}

const chaveRecorde = () => 'modelos.recorde.' + MECANICAS[mec].id;

function recalcular() {
  S.cabe = [0, 1, 2].map((k) => slotCabe(E, k));
  S.dica = null;
  if (S.tutorial && !E.fim) {
    const j = escolherJogada(E);
    if (j && j.tipo === 'colocar' && !j.giros) S.dica = j;
  }
}

function novaPartida() {
  E = criarPartida({ mec, semente: semente++ });
  S.arrasto = null;
  S.recorde = armazem.ler(chaveRecorde(), 0);
  S.recordeNovo = false;
  bot = null;
  esperaBot = 0.6;
  esperaFim = 0;
  redimensionar();
  cena.reiniciar();
  recalcular();
}

/** Eventos da partida: cena, sons e recorde. @param {any[]|null} ev */
function processar(ev) {
  if (!ev) return;
  cena.eventos(ev, E);
  for (const e of ev) {
    if (e.tipo === 'colocou') tocar('colocar', { n: e.cels.length });
    else if (e.tipo === 'limpou' && e.seq) tocar('limpar', { k: e.k, seq: e.seq });
    else if (e.tipo === 'sequencia') tocar('combo', { seq: e.seq });
    else if (e.tipo === 'feitico') tocar('feitico');
    else if (e.tipo === 'magia') tocar('magia');
    else if (e.tipo === 'bomba' && e.contador <= 2) tocar('tique');
    else if (e.tipo === 'explodiu') tocar('explodiu');
    else if (e.tipo === 'estrela') tocar('estrela');
    else if (e.tipo === 'coletou') tocar('coletou');
    else if (e.tipo === 'girou') tocar('girar');
    else if (e.tipo === 'fim') {
      tocar('fim');
      if (E.pontos > S.recorde) {
        S.recordeNovo = true;
        armazem.gravar(chaveRecorde(), E.pontos);
      }
    }
  }
  recalcular();
}

// ------------------------------------------------------------------ tema e tela
function aplicarTema() {
  const tema = TEMAS[temaIdx];
  cena.definirTema(tema);
  SONS = criarSons(tema.timbre);
  document.body.style.background = tema.painel.fundo;
  atualizarBarra();
}

function redimensionar() {
  const r = palco.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cena.redimensionar(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), dpr, E ? E.n : 8);
}

function escreverHash() {
  if (P.fixo || P.filme) return;
  const partes = [`tema=${temaIdx + 1}`];
  if (mec !== TEMAS[temaIdx].mec) partes.push(`mec=${mec}`);
  if (auto) partes.push('auto');
  try { history.replaceState(null, '', '#' + partes.join('&')); } catch { /* ignora */ }
}

/** @param {number} k */
function trocarTema(k) {
  temaIdx = k;
  mec = TEMAS[k].mec;
  aplicarTema();
  novaPartida();
  escreverHash();
}

function montarBarra() {
  barra.innerHTML = '';
  const hub = document.createElement('a');
  hub.href = 'index.html';
  hub.textContent = '← fichas';
  barra.append(hub);
  TEMAS.forEach((t, k) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.dataset.k = String(k);
    b.textContent = `${k + 1} ${t.nome}`;
    b.addEventListener('click', () => trocarTema(k));
    barra.append(b);
  });
  const sel = document.createElement('select');
  sel.id = 'mec';
  sel.title = 'Mecanica';
  NOMES_MEC.forEach((nome, k) => {
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = nome;
    sel.append(o);
  });
  sel.addEventListener('change', () => {
    mec = Number(sel.value);
    novaPartida();
    escreverHash();
    sel.blur();
  });
  barra.append(sel);
  const sep = document.createElement('span');
  sep.className = 'sep';
  barra.append(sep);
  const bAuto = document.createElement('button');
  bAuto.id = 'auto';
  bAuto.addEventListener('click', () => { auto = !auto; bot = null; S.arrasto = null; atualizarBarra(); escreverHash(); });
  barra.append(bAuto);
  const bNova = document.createElement('button');
  bNova.textContent = '↻ nova';
  bNova.addEventListener('click', () => novaPartida());
  barra.append(bNova);
}

function atualizarBarra() {
  for (const b of barra.querySelectorAll('button[role="tab"]')) {
    b.setAttribute('aria-selected', String(Number(/** @type {HTMLElement} */ (b).dataset.k) === temaIdx));
  }
  const sel = /** @type {HTMLSelectElement|null} */ (document.getElementById('mec'));
  if (sel) sel.value = String(mec);
  const bAuto = document.getElementById('auto');
  if (bAuto) bAuto.textContent = auto ? '⏸ bot' : '▶ bot';
}

// ------------------------------------------------------------------ arrasto
/** Lugar da peca (centro) quando ja cresceu: segue o dedo, acima dele no toque. */
function calcularAlvo(a) {
  const L = cena.L;
  if (a.slot === 3) {
    a.alvo = casaEm(L, a.fx, a.fy);
    a.previa = null;
    return;
  }
  const { w, h } = limites(a.peca.cels);
  const gx = Math.round((a.fx - (w * L.cs) / 2 - L.tab.x) / L.cs);
  const gy = Math.round((a.fy - (h * L.cs) / 2 - L.tab.y) / L.cs);
  const pv = previa(E.t, a.peca.cels, gx, gy, !!E.regras.quadrantes);
  a.alvo = pv ? { gx, gy } : null;
  a.previa = pv && pv.celulas.size ? pv.celulas : null;
}

/** Origem visual do arrasto (centro da vaga ou do orbe). @param {number} slot */
function origem(slot) {
  const L = cena.L;
  if (slot === 3) return { x: L.orbe.x + L.orbe.w / 2, y: L.orbe.y + L.orbe.h / 2 };
  return cena.centroVaga(slot);
}

/** Posicao desenhada: da vaga ate o dedo conforme a peca cresce. */
function posicionar(a, dt) {
  if (a.moveu || !E.regras.girar || a.slot === 3) a.cresce = Math.min(1, a.cresce + dt / 0.1);
  const o = origem(a.slot);
  const k = 1 - Math.pow(1 - a.cresce, 2);
  a.x = o.x + (a.fx - o.x) * k;
  a.y = o.y + (a.fy - o.y) * k;
}

/** @param {PointerEvent} e */
function ponto(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.iniciar();
  const { x, y } = ponto(e);
  if (E.fim) {
    const b = cena.botaoRecomecar;
    if (cena.fimVisivel && b && dentro(b, x, y)) novaPartida();
    return;
  }
  if (S.arrasto || bot) return;
  const L = cena.L;
  const toque = e.pointerType !== 'mouse';
  if (E.feitico && dentro(L.orbe, x, y, 12)) {
    S.tutorial = false;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    const desloc = toque ? L.cs * 1.2 : 0;
    S.arrasto = { slot: 3, peca: null, fx: x, fy: y - desloc, x, y, x0: x, y0: y, desloc, pid: e.pointerId, moveu: false, cresce: 0, alvo: null, previa: null };
    tocar('pegar');
    return;
  }
  const k = vagaEm(L, x, y);
  if (k < 0 || !E.bandeja[k]) return;
  S.tutorial = false;
  S.dica = null;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora */ }
  const p = E.bandeja[k];
  const { h } = limites(p.cels);
  const desloc = toque ? (h * L.cs) / 2 + L.cs * 0.7 : 0;
  const o = origem(k);
  S.arrasto = { slot: k, peca: p, fx: x, fy: y - desloc, x: o.x, y: o.y, x0: x, y0: y, desloc, pid: e.pointerId, moveu: false, cresce: 0, alvo: null, previa: null };
  calcularAlvo(S.arrasto);
  tocar('pegar');
});

canvas.addEventListener('pointermove', (e) => {
  const a = S.arrasto;
  if (!a || a.pid !== e.pointerId) return;
  const { x, y } = ponto(e);
  a.fx = x;
  a.fy = y - a.desloc;
  if (!a.moveu && Math.hypot(x - a.x0, y - a.y0) > ARRASTO_MIN) a.moveu = true;
  calcularAlvo(a);
});

/** @param {PointerEvent} e */
function soltar(e) {
  const a = S.arrasto;
  if (!a || a.pid !== e.pointerId) return;
  S.arrasto = null;
  if (a.slot === 3) {
    if (a.alvo && e.type !== 'pointercancel') processar(usarFeitico(E, a.alvo.gx, a.alvo.gy));
    return;
  }
  if (!a.moveu && E.regras.girar && e.type !== 'pointercancel') {
    processar(girar(E, a.slot));
    return;
  }
  if (a.alvo && e.type !== 'pointercancel') {
    const ev = colocar(E, a.slot, a.alvo.gx, a.alvo.gy);
    if (ev) { processar(ev); return; }
  }
  if (a.moveu) tocar('recusa');
  cena.voltar(a.slot, a.x, a.y);
  recalcular();
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.repeat || P.fixo || P.filme) return;
  if (e.key >= '1' && e.key <= String(TEMAS.length)) trocarTema(Number(e.key) - 1);
  else if (e.key === 'r' || e.key === 'R') novaPartida();
  else if (e.key === 'a' || e.key === 'A') { auto = !auto; bot = null; S.arrasto = null; atualizarBarra(); escreverHash(); }
});
window.addEventListener('hashchange', () => {
  const Q = lerParametros();
  if (Q.tema - 1 !== temaIdx || (Q.mec ?? TEMAS[Q.tema - 1].mec) !== mec) {
    temaIdx = Q.tema - 1;
    mec = Q.mec ?? TEMAS[temaIdx].mec;
    aplicarTema();
    novaPartida();
  }
});

// ------------------------------------------------------------------ bot
const suave = (u) => u * u * (3 - 2 * u);

/** @param {number} dt */
function passoBot(dt) {
  if (E.fim) {
    esperaFim += dt;
    if (esperaFim > 2.6) novaPartida();
    return;
  }
  if (!bot) {
    esperaBot -= dt;
    if (esperaBot > 0) return;
    const j = escolherJogada(E, { rng: rngBot, ruido: P.ruido });
    if (!j) return;
    bot = { j, t: 0, giros: 0, voando: false };
  }
  const j = bot.j;
  bot.t += dt;
  if (j.tipo === 'colocar' && bot.giros < j.giros) {
    if (bot.t > 0.25) {
      processar(girar(E, j.slot));
      bot.giros++;
      bot.t = 0;
    }
    return;
  }
  const L = cena.L;
  if (!bot.voando) {
    bot.voando = true;
    bot.t = 0;
    const o = origem(j.tipo === 'feitico' ? 3 : j.slot);
    let para;
    if (j.tipo === 'feitico') para = { x: L.tab.x + (j.gx + 0.5) * L.cs, y: L.tab.y + (j.gy + 0.5) * L.cs };
    else {
      const { w, h } = limites(/** @type {any} */ (E.bandeja[j.slot]).cels);
      para = { x: L.tab.x + (j.gx + w / 2) * L.cs, y: L.tab.y + (j.gy + h / 2) * L.cs };
    }
    bot.de = o;
    bot.para = para;
    S.arrasto = { slot: j.tipo === 'feitico' ? 3 : j.slot, peca: j.tipo === 'feitico' ? null : E.bandeja[j.slot], fx: o.x, fy: o.y, x: o.x, y: o.y, moveu: true, cresce: 0, alvo: null, previa: null, pid: -1 };
    tocar('pegar');
  }
  const a = S.arrasto;
  const k = suave(Math.min(1, bot.t / VOO_BOT));
  a.fx = bot.de.x + (bot.para.x - bot.de.x) * k;
  a.fy = bot.de.y + (bot.para.y - bot.de.y) * k - Math.sin(k * Math.PI) * L.cs * 0.6;
  calcularAlvo(a);
  if (bot.t >= VOO_BOT + 0.1) {
    S.arrasto = null;
    processar(aplicarJogada(E, { ...j, giros: 0 }));
    bot = null;
    esperaBot = 0.3;
  }
}

// ------------------------------------------------------------------ laco
/** @param {number} dt */
function passo(dt) {
  cena.atualizar(dt);
  if (P.fixo) return;
  if (S.arrasto) posicionar(S.arrasto, dt);
  if (auto) passoBot(dt);
}

function desenhar() {
  cena.desenhar(E, S);
}

/** Joga N jogadas do bot na hora (sem animar), para comecar com o tabuleiro cheio. @param {number} n */
function preJogar(n) {
  const rng = criarRng(semente * 13 + 1);
  for (let k = 0; k < n && !E.fim; k++) {
    const j = escolherJogada(E, { rng, ruido: 30 });
    if (!j) break;
    aplicarJogada(E, j);
  }
  // nao comeca com fim de jogo
  if (E.fim) { E = criarPartida({ mec, semente: semente++ }); preJogar(Math.floor(n / 2)); return; }
  cena.reiniciar();
  cena.fixarPlacar(E.pontos);
  cena.atualizar(1.2);
  recalcular();
}

/** Cena parada para print: uma peca no ar com a previa acesa. */
function montarFixo() {
  if (E.regras.mana && !E.feitico) E.mana = 0.62;
  const j = escolherJogada(E);
  if (!j || j.tipo !== 'colocar') return;
  for (let k = 0; k < j.giros; k++) girar(E, j.slot);
  const L = cena.L;
  const p = /** @type {any} */ (E.bandeja[j.slot]);
  const { w, h } = limites(p.cels);
  const fx = L.tab.x + (j.gx + w / 2) * L.cs + L.cs * 0.12;
  const fy = L.tab.y + (j.gy + h / 2) * L.cs - L.cs * 0.22;
  S.arrasto = { slot: j.slot, peca: p, fx, fy, x: fx, y: fy, moveu: true, cresce: 1, alvo: null, previa: null, pid: -1 };
  calcularAlvo(S.arrasto);
  recalcular();
}

/** Gera os quadros do GIF sem relogio real e escreve em <pre id="filme">. */
function gravarFilme() {
  const fps = P.filme;
  const passos = Math.max(1, Math.round(1 / (fps * PASSO)));
  const total = Math.round((P.dur / 1000) * fps);
  const esc = Math.min(1, P.larg / canvas.clientWidth);
  const off = document.createElement('canvas');
  off.width = Math.round(canvas.clientWidth * esc);
  off.height = Math.round(canvas.clientHeight * esc);
  const octx = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
  const quadros = [];
  for (let i = 0; i < total; i++) {
    for (let s = 0; s < passos; s++) passo(PASSO);
    desenhar();
    octx.drawImage(canvas, 0, 0, off.width, off.height);
    quadros.push(off.toDataURL('image/jpeg', 0.84));
  }
  const pre = /** @type {HTMLElement} */ (document.getElementById('filme'));
  pre.textContent = quadros.join('\n');
  document.title = 'filme ' + quadros.length;
}

/** Ganchos para as ferramentas (tools/) lerem o estado e o layout. */
globalThis.__magicblock = {
  estado: () => ({ jogadas: E.jogadas, pontos: E.pontos, fim: E.fim, n: E.n, bandeja: E.bandeja.map((p) => (p ? p.cels : null)), cor: [...E.t.cor] }),
  layout: () => cena.L,
};

async function iniciar() {
  montarBarra();
  aplicarTema();
  try { await document.fonts.load('700 24px Fredoka'); } catch { /* segue com a fonte do sistema */ }
  novaPartida();
  if (P.pre > 0) preJogar(P.pre);
  if (P.mana >= 0 && E.regras.mana) E.mana = Math.min(0.99, P.mana);
  if (P.fixo) montarFixo();
  new ResizeObserver(() => redimensionar()).observe(palco);
  escreverHash();
  atualizarBarra();
  if (P.filme) {
    gravarFilme();
    return;
  }
  const laco = criarLaco({ passo, desenhar });
  laco.iniciar();
  document.addEventListener('visibilitychange', () => audio.pausarAba(document.hidden));
}

iniciar();

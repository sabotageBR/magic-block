// Liga tudo no Magic Block: o nucleo (src/jogo, mecanica "galaxia": girar + estrelas), a cena
// (src/render, tema Galaxia), a entrada (toque, mouse e teclado), o som (efeitos e musica sintetizados),
// o save e a camada do portal (core/plataforma.js). Unico dono do SDK, do DOM, do audio e do save.
//
// Fluxo do SDK: init() no fim da montagem e o laco so depois do handshake (lacoAposInit; sem ele o laco
// comeca antes); idioma pelo portal; gameplayStart no primeiro toque ou tecla de jogo de cada trecho
// (jogadorAgiu); gameplayStop no menu de pausa, no fim de jogo, no sinal pause do portal e antes de todo
// anuncio. Pontos naturais do intervalo comercial: "Jogar de novo" e "Recomecar", sempre logo depois do
// clique no botao (gameplayStop -> commercialBreak -> o proximo toque manda o gameplayStart).
// Recompensado: "Reviver" no fim de jogo (rewardedBreak em objeto, premio so com true, botao escondido sem
// anuncio possivel). O sinal mute cala o mestre sem mexer nos botoes do jogador.
//
// Build da Y8 (tools/empacotar.mjs --alvo=y8, adaptador core/portais/y8.js), pelas marcas do portal:
// - intervaloSoNoClique: os dois pontos ja sao cliques em botao; o jogo so pede o intervalo se passaram
//   INTERVALO_MIN_S desde o anterior (contando da abertura: o pre-roll e da propria Y8);
// - pausaSoNoAnuncio: congela e cala so no onAdStart (o beforeAd), nao no pedido (break pulado nao congela);
//   durante o pedido o toque so fica travado, para nao jogar no tabuleiro que vai sumir;
// - pausaNoBlur: perder o foco (blur ou aba oculta) abre o menu de pausa.

import { lerDepuracao } from './core/depuracao.js';
import { criarLaco, PASSO } from './core/laco.js';
import { criarAudio } from './core/audio.js';
import { criarArmazem } from './core/armazenamento.js';
import { portal } from './core/plataforma.js';
import { definirVibracao, vibracaoSuportada, vibrar } from './core/haptico.js';
import { criarRng } from './core/rng.js';
import { criarCena } from './render/cena.js';
import { casaEm, dentro, vagaEm } from './render/layout.js';
import tema from './render/tema.js';
import { SONS } from './som/galaxia.js';
import { criarMusica } from './som/musica.js';
import { TEXTOS, texto } from './i18n/textos.js';
import { colocar, criarPartida, girar, podeReviver, restaurarPartida, reviver, serializarPartida, slotCabe } from './jogo/partida.js';
import { MEC_JOGO } from './jogo/regras.js';
import { lugares, previa } from './jogo/tabuleiro.js';
import { limites } from './jogo/formas.js';
import { aplicarJogada, escolherJogada } from './jogo/bot.js';

const dep = lerDepuracao();
const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const ARRASTO_MIN = 8;
const VOO_BOT = 0.42;
/** Y8 (portal.intervaloSoNoClique): no minimo este tempo entre dois intervalos comerciais, s. */
const INTERVALO_MIN_S = 180;

/**
 * Idioma da interface (pt, en ou es): o forcado (?lang, so no teste local) e o do portal
 * (getLanguage(), que ja le o ?lang= do iframe); sem nenhum deles, ingles. Nunca o do navegador.
 * @param {...any} candidatos
 */
function escolherIdioma(...candidatos) {
  for (const c of candidatos) {
    if (!c) continue;
    const k = String(c).toLowerCase().slice(0, 2);
    if (TEXTOS[k]) return k;
  }
  return 'en';
}
const idiomaAgora = () => escolherIdioma(dep.lang, portal.idioma);
let lang = idiomaAgora();
const T = (/** @type {string} */ k) => texto(lang, k);

const armazem = criarArmazem();
const prefs = { efeitos: true, musica: true, vibracao: true, ...(armazem.ler('prefs', {}) || {}) };
const salvarPrefs = () => armazem.gravar('prefs', prefs);
const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
if (toque) document.body.classList.add('toque');
if (dep.semHud) document.body.classList.add('semhud');

// ------------------------------------------------------------------ estado
const canvas = /** @type {HTMLCanvasElement} */ ($('tela'));
const palco = $('palco');
const cena = criarCena(canvas);
cena.definirTema(tema);
const audio = criarAudio();
const musica = criarMusica(audio);
audio.definirMudo(!prefs.efeitos);
audio.definirMusica(!!prefs.musica);
definirVibracao(!!prefs.vibracao);

/** @type {import('./jogo/partida.js').Partida} */
let E = /** @type {any} */ (null);
/** estado que a cena le */
const S = { arrasto: /** @type {any} */ (null), recorde: Number(armazem.ler('recorde', 0)) || 0, recordeNovo: false, dica: /** @type {any} */ (null), tutorial: false, cabe: [true, true, true], fimDom: true, semHud: dep.semHud };
let tutorialVisto = !!armazem.ler('tutorial', false) || dep.semTutorial;
/** jogando: entre o gameplayStart (toque/tecla) e o gameplayStop */
let jogou = false;
let menuAberto = false;
let fimAberto = false;
let emAnuncio = false;
/** o anuncio esta na tela (onAdStart ate onAdEnd): o jogo congela e cala */
let anuncioNaTela = false;
/** Y8: congela so com o anuncio na tela; nos outros portais, desde o pedido */
const congelaNoPedido = !portal.pausaSoNoAnuncio;
/** relogio (Date.now) do ultimo intervalo pedido; comeca na abertura (Y8: o pre-roll e deles) */
let ultimoIntervalo = Date.now();
/** pausa pedida pelo portal (sinal pause/resume): congela o jogo */
let pausaPortal = false;
let sementeBase = dep.semente || ((Date.now() / 1000) | 0);
const rngBot = criarRng(sementeBase * 31 + 5);
/** @type {any} */
let bot = null;
let esperaBot = 0.6;
/** selecao do teclado: peca escolhida e a casa do canto */
/** @type {{ slot: number, gx: number, gy: number } | null} */
let sel = null;

/** @param {string} nome @param {any} [p] */
function tocar(nome, p = {}) {
  const r = SONS[nome];
  if (r) audio.tocarReceita(r, p, { chave: nome, max: 3 });
}

function salvarPartida() {
  armazem.gravar('partida', E && !E.fim ? serializarPartida(E) : null);
}

function recalcular() {
  S.cabe = [0, 1, 2].map((k) => slotCabe(E, k));
  S.tutorial = !tutorialVisto && !E.fim;
  S.dica = null;
  if (S.tutorial) {
    const j = escolherJogada(E);
    if (j && j.tipo === 'colocar' && !j.giros) S.dica = j;
  }
}

function novaPartida() {
  E = criarPartida({ mec: MEC_JOGO, semente: sementeBase++ });
  limparSelecao();
  S.recordeNovo = false;
  bot = null;
  esperaBot = 0.6;
  cena.reiniciar();
  recalcular();
  salvarPartida();
  portal.measure('level', 'infinito', 'start');
}

function carregarPartida() {
  const salva = dep.novo ? null : restaurarPartida(armazem.ler('partida', null));
  if (salva && !salva.fim) {
    E = salva;
    cena.reiniciar();
    cena.fixarPlacar(E.pontos);
    recalcular();
  } else novaPartida();
}

/** Eventos da partida: cena, som, vibracao, recorde e save. @param {any[]|null} ev */
function processar(ev) {
  if (!ev) return;
  cena.eventos(ev);
  for (const e of ev) {
    switch (e.tipo) {
      case 'colocou':
        tocar('colocar', { n: e.cels.length });
        vibrar(12);
        if (!tutorialVisto) { tutorialVisto = true; armazem.gravar('tutorial', true); }
        break;
      case 'limpou':
        if (e.seq) {
          tocar('limpar', { k: e.k, seq: e.seq, dobro: e.dobro });
          vibrar(e.k >= 2 ? [30, 40, 50] : 28);
        }
        break;
      case 'sequencia': tocar('combo', { seq: e.seq }); break;
      case 'perfeito': tocar('perfeito'); vibrar([40, 60, 40, 60, 90]); break;
      case 'aviso': tocar('aviso'); break;
      case 'estrela': tocar('estrela'); break;
      case 'coletou': tocar('coletou'); vibrar([20, 30, 20]); break;
      case 'girou': tocar('girar', { giro: E.jogadas }); break;
      case 'bandeja': tocar('bandeja'); break;
      case 'reviveu': tocar('reviver'); vibrar([30, 50, 30]); break;
      case 'fim':
        tocar(S.recordeNovo ? 'recorde' : 'fim');
        vibrar(S.recordeNovo ? [30, 40, 30, 40, 80] : 120);
        pararJogo();
        portal.measure('level', 'infinito', 'fail');
        break;
      default: break;
    }
  }
  if (E.pontos > S.recorde) {
    S.recorde = E.pontos;
    S.recordeNovo = true;
    armazem.gravar('recorde', S.recorde);
  }
  recalcular();
  salvarPartida();
}

// ------------------------------------------------------------------ SDK: gameplay, intervalo e sinais
/** O jogo parou (menu, fim, intervalo, pausa do portal): o proximo toque ou tecla manda o gameplayStart. */
function pararJogo() {
  if (!jogou) return;
  jogou = false;
  portal.gameplayStop();
}

/** Toque (fase baixo) ou tecla de jogo: abre o trecho de gameplay se ainda nao abriu. */
function jogadorAgiu() {
  audio.iniciar();
  if (jogou || menuAberto || fimAberto || emAnuncio || pausaPortal || !E || E.fim) return;
  jogou = true;
  portal.gameplayStart();
}

/**
 * Intervalo comercial num ponto natural, sempre logo depois do clique num botao ("Jogar de novo",
 * "Recomecar"): gameplayStop, o anuncio (o jogo congela) e a volta. Na Y8, no maximo 1 a cada INTERVALO_MIN_S.
 */
async function intervalo() {
  pararJogo();
  if (dep.semAnuncio || emAnuncio) return;
  if (portal.intervaloSoNoClique && Date.now() - ultimoIntervalo < INTERVALO_MIN_S * 1000) return;
  emAnuncio = true;
  const pediu = await portal.commercialBreak();
  emAnuncio = false;
  if (pediu) ultimoIntervalo = Date.now();
}

portal.onAdStart = () => {
  anuncioNaTela = true;
  audio.mudoParaAnuncio();
};
portal.onAdEnd = () => {
  anuncioNaTela = false;
  audio.voltarDoAnuncio();
};
// sinais do portal (idempotentes): o mudo dele fica por cima dos botoes do jogador (o unmute nunca
// religa o que ele desligou); a pausa congela o jogo e para o gameplay, sem abrir nem fechar o menu
portal.onMudoPlataforma = (mudo) => { audio.definirMudoPlataforma(mudo); };
portal.onPausaPlataforma = (pausa) => {
  pausaPortal = pausa;
  if (pausa) {
    pararJogo();
    soltarArrasto();
  }
};
document.addEventListener('visibilitychange', () => {
  audio.pausarAba(document.hidden);
  if (document.hidden) {
    salvarPartida();
    pausaPorFoco();
  }
});
// Y8 (pausaNoBlur): perder o foco abre a pausa (requisito do portal)
window.addEventListener('blur', () => pausaPorFoco());

/** O jogo perdeu o foco: abre o menu de pausa, sem som e sem puxar o foco de volta (so onde o portal pede). */
function pausaPorFoco() {
  if (!portal.pausaNoBlur || emAnuncio) return;
  abrirMenu(true);
}

// ------------------------------------------------------------------ menus
function aplicarTextos() {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = T(/** @type {HTMLElement} */ (el).dataset.t || '');
  $('btnPausa').title = T('bt.pausa');
  $('btnPausa').setAttribute('aria-label', T('bt.pausa'));
  cena.definirRotulos({ combo: T('combo'), puro: T('puro'), perfeito: T('perfeito') });
  atualizarChaves();
}

function atualizarChaves() {
  for (const [id, chave] of [['btnEfeitos', 'efeitos'], ['btnMusica', 'musica'], ['btnVibracao', 'vibracao']]) {
    const b = $(id);
    const on = !!(/** @type {any} */ (prefs))[chave];
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', `${T(chave)}: ${T(on ? 'ligado' : 'desligado')}`);
  }
  $('btnVibracao').hidden = !vibracaoSuportada();
}

/** @param {boolean} [porFoco] aberto porque o jogo perdeu o foco: sem som e sem focar o botao */
function abrirMenu(porFoco = false) {
  if (menuAberto || fimAberto || !E) return;
  menuAberto = true;
  pararJogo();
  soltarArrasto();
  $('menu').hidden = false;
  if (!porFoco) {
    $('btnContinuar').focus({ preventScroll: true });
    tocar('botao');
  }
  salvarPartida();
}

function fecharMenu() {
  if (!menuAberto) return;
  menuAberto = false;
  $('menu').hidden = true;
}

function mostrarFim() {
  fimAberto = true;
  $('fimPontos').textContent = String(E.pontos);
  $('fimRecorde').textContent = String(Math.max(S.recorde, E.pontos));
  $('fimNovo').hidden = !S.recordeNovo;
  $('fimAviso').hidden = true;
  const premio = /** @type {HTMLButtonElement} */ ($('btnReviver'));
  premio.hidden = !(podeReviver(E) && portal.temAnuncios && !dep.semAnuncio);
  premio.disabled = false;
  $('fim').hidden = false;
  $('btnDeNovo').focus({ preventScroll: true });
}

function esconderFim() {
  fimAberto = false;
  $('fim').hidden = true;
}

$('btnPausa').addEventListener('click', () => { audio.iniciar(); abrirMenu(); });
$('btnContinuar').addEventListener('click', () => { tocar('botao'); fecharMenu(); });
$('btnRecomecar').addEventListener('click', async () => {
  tocar('botao');
  fecharMenu();
  await intervalo();
  novaPartida();
});
$('btnEfeitos').addEventListener('click', () => {
  prefs.efeitos = !prefs.efeitos;
  audio.definirMudo(!prefs.efeitos);
  salvarPrefs();
  atualizarChaves();
  tocar('botao');
});
$('btnMusica').addEventListener('click', () => {
  prefs.musica = !prefs.musica;
  audio.definirMusica(prefs.musica);
  salvarPrefs();
  atualizarChaves();
  tocar('botao');
});
$('btnVibracao').addEventListener('click', () => {
  prefs.vibracao = !prefs.vibracao;
  definirVibracao(prefs.vibracao);
  if (prefs.vibracao) vibrar(30);
  salvarPrefs();
  atualizarChaves();
  tocar('botao');
});
$('btnDeNovo').addEventListener('click', async () => {
  tocar('botao');
  esconderFim();
  await intervalo();
  novaPartida();
});
$('btnReviver').addEventListener('click', async () => {
  const b = /** @type {HTMLButtonElement} */ ($('btnReviver'));
  if (b.disabled || emAnuncio || !podeReviver(E)) return;
  b.disabled = true;
  emAnuncio = true;
  const ok = await portal.rewardedBreak('medium');
  emAnuncio = false;
  if (ok) {
    portal.measure('reward', 'reviver', 'ok');
    esconderFim();
    processar(reviver(E));
  } else {
    b.hidden = true;
    $('fimAviso').textContent = T('videoFalhou');
    $('fimAviso').hidden = false;
  }
});

// ------------------------------------------------------------------ arrasto (toque e mouse)
/** Casa do canto da peca a partir do centro desenhado; previa do que limpa. */
function calcularAlvo(a) {
  const L = cena.L;
  const { w, h } = limites(a.peca.cels);
  const gx = Math.round((a.fx - (w * L.cs) / 2 - L.tab.x) / L.cs);
  const gy = Math.round((a.fy - (h * L.cs) / 2 - L.tab.y) / L.cs);
  const pv = previa(E.t, a.peca.cels, gx, gy, false);
  a.alvo = pv ? { gx, gy } : null;
  a.previa = pv && pv.celulas.size ? pv.celulas : null;
}

/** Centro da peca com o canto na casa (gx, gy). */
function centroNaCasa(peca, gx, gy) {
  const L = cena.L;
  const { w, h } = limites(peca.cels);
  return { x: L.tab.x + (gx + w / 2) * L.cs, y: L.tab.y + (gy + h / 2) * L.cs };
}

/** Posicao desenhada: da vaga ate o dedo conforme a peca cresce (no toque so cresce depois de mexer). */
function posicionar(a, dt) {
  if (a.moveu || a.teclado) a.cresce = Math.min(1, a.cresce + dt / 0.1);
  const o = cena.centroVaga(a.slot);
  const k = 1 - Math.pow(1 - a.cresce, 2);
  a.x = o.x + (a.fx - o.x) * k;
  a.y = o.y + (a.fy - o.y) * k;
}

function soltarArrasto() {
  if (S.arrasto && S.arrasto.pid >= 0) cena.voltar(S.arrasto.slot, S.arrasto.x, S.arrasto.y);
  S.arrasto = null;
  sel = null;
}

function limparSelecao() {
  sel = null;
  S.arrasto = null;
}

/** @param {PointerEvent} e */
function ponto(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

const podeJogar = () => !!E && !E.fim && !menuAberto && !fimAberto && !emAnuncio && !pausaPortal && !bot;

canvas.addEventListener('pointerdown', (e) => {
  // fase baixo: o toque que abre o gameplay
  jogadorAgiu();
  if (!podeJogar() || (S.arrasto && S.arrasto.pid >= 0)) return;
  const { x, y } = ponto(e);
  const L = cena.L;
  const k = vagaEm(L, x, y);
  if (k < 0 || !E.bandeja[k]) return;
  sel = null;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora */ }
  const p = E.bandeja[k];
  const { h } = limites(p.cels);
  const desloc = e.pointerType !== 'mouse' ? (h * L.cs) / 2 + L.cs * 0.7 : 0;
  const o = cena.centroVaga(k);
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
  if (!podeJogar()) return;
  if (!a.moveu && e.type !== 'pointercancel') {
    processar(girar(E, a.slot));
    return;
  }
  if (a.alvo && e.type !== 'pointercancel') {
    const ev = colocar(E, a.slot, a.alvo.gx, a.alvo.gy);
    if (ev) { processar(ev); return; }
  }
  if (a.moveu) tocar('recusa');
  cena.voltar(a.slot, a.x, a.y);
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ------------------------------------------------------------------ teclado
/** Mostra a peca escolhida no teclado sobre o tabuleiro, com a previa. */
function mostrarSelecao() {
  if (!sel || !E.bandeja[sel.slot]) { limparSelecao(); return; }
  const p = E.bandeja[sel.slot];
  const { w, h } = limites(p.cels);
  sel.gx = Math.max(0, Math.min(E.n - w, sel.gx));
  sel.gy = Math.max(0, Math.min(E.n - h, sel.gy));
  const c = centroNaCasa(p, sel.gx, sel.gy);
  const a = S.arrasto && S.arrasto.teclado ? S.arrasto : { slot: sel.slot, peca: p, x: c.x, y: c.y, cresce: 0, moveu: true, pid: -2, teclado: true, alvo: null, previa: null };
  a.slot = sel.slot;
  a.peca = p;
  a.fx = c.x;
  a.fy = c.y;
  calcularAlvo(a);
  S.arrasto = a;
}

/** Escolhe a peca do slot no teclado, comecando no primeiro lugar livre perto do centro. @param {number} slot */
function escolherPeca(slot) {
  const p = E.bandeja[slot];
  if (!p) return;
  const livres = lugares(E.t, p.cels);
  const meio = (E.n - 1) / 2;
  livres.sort((a, b) => Math.hypot(a[0] - meio, a[1] - meio) - Math.hypot(b[0] - meio, b[1] - meio));
  const [gx, gy] = livres[0] || [0, 0];
  sel = { slot, gx, gy };
  S.arrasto = null;
  mostrarSelecao();
  tocar('pegar');
}

const ROLAGEM = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown', 'Home', 'End']);
window.addEventListener('keydown', (e) => {
  if (ROLAGEM.has(e.key) && !menuAberto && !fimAberto) e.preventDefault();
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (menuAberto) fecharMenu();
    else if (sel) limparSelecao();
    else abrirMenu();
    return;
  }
  if (menuAberto || fimAberto) return;
  const jogo = /^[123]$/.test(e.key) || e.key === 'Tab' || /^Arrow/.test(e.key) || e.key === 'Enter' || e.key === ' ' || e.key === 'r' || e.key === 'R';
  if (!jogo) return;
  e.preventDefault();
  // tecla de jogo: abre o gameplay
  jogadorAgiu();
  if (!podeJogar()) return;
  if (/^[123]$/.test(e.key)) { escolherPeca(Number(e.key) - 1); return; }
  if (e.key === 'Tab') {
    for (let d = 1; d <= 3; d++) {
      const k = ((sel ? sel.slot : -1) + d + 3) % 3;
      if (E.bandeja[k]) { escolherPeca(k); return; }
    }
    return;
  }
  if (!sel) {
    const k = E.bandeja.findIndex((p, i) => p && S.cabe[i]);
    escolherPeca(k >= 0 ? k : E.bandeja.findIndex((p) => p));
    return;
  }
  if (/^Arrow/.test(e.key)) {
    sel.gx += e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    sel.gy += e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    mostrarSelecao();
  } else if (e.key === 'r' || e.key === 'R') {
    processar(girar(E, sel.slot));
    mostrarSelecao();
  } else if (e.key === 'Enter' || e.key === ' ') {
    const a = S.arrasto;
    const ev = a && a.alvo ? colocar(E, sel.slot, a.alvo.gx, a.alvo.gy) : null;
    if (ev) {
      limparSelecao();
      processar(ev);
    } else tocar('recusa');
  }
});

// ------------------------------------------------------------------ bot (?auto, prints e video)
const suave = (u) => u * u * (3 - 2 * u);
/** @param {number} dt */
function passoBot(dt) {
  if (E.fim) return;
  if (!bot) {
    esperaBot -= dt;
    if (esperaBot > 0) return;
    const j = escolherJogada(E, { rng: rngBot, ruido: dep.ruido });
    if (!j || j.tipo !== 'colocar') return;
    bot = { j, t: 0, giros: 0, voando: false };
  }
  const j = bot.j;
  bot.t += dt;
  if (bot.giros < j.giros) {
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
    bot.de = cena.centroVaga(j.slot);
    bot.para = centroNaCasa(E.bandeja[j.slot], j.gx, j.gy);
    S.arrasto = { slot: j.slot, peca: E.bandeja[j.slot], fx: bot.de.x, fy: bot.de.y, x: bot.de.x, y: bot.de.y, moveu: true, cresce: 0, alvo: null, previa: null, pid: -1 };
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
let tFimAuto = 0;
/** @param {number} dt */
function passo(dt) {
  if ((emAnuncio && congelaNoPedido) || anuncioNaTela || pausaPortal || menuAberto) return;
  cena.atualizar(dt);
  if (S.arrasto) posicionar(S.arrasto, dt);
  // pedido de anuncio em andamento (Y8, antes do beforeAd): so a cena anda; o fim e o bot esperam a volta
  if (emAnuncio) return;
  if (dep.auto && !fimAberto) passoBot(dt);
  if (E.fim && !fimAberto && cena.fimComecou) {
    if (dep.auto) {
      tFimAuto += dt;
      if (tFimAuto > 2.2) { tFimAuto = 0; novaPartida(); }
    } else mostrarFim();
  }
}

function posicionarPausa() {
  const r = cena.L.pausa;
  const b = $('btnPausa');
  if (!r) return;
  const p = palco.getBoundingClientRect();
  b.style.left = `${p.left + r.x}px`;
  b.style.top = `${p.top + r.y}px`;
  b.style.width = `${r.w}px`;
  b.style.height = `${r.h}px`;
}

function desenhar() {
  cena.desenhar(E, S);
  if (dep.debug) {
    $('debug').hidden = false;
    $('debug').textContent = `fps ${laco.medidas.fps.toFixed(0)} | desenho ${laco.medidas.desenhoMs.toFixed(2)} ms | particulas ${cena.fx.quantas}`;
  }
}
const laco = criarLaco({ passo, desenhar });

function redimensionar() {
  const r = palco.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cena.redimensionar(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), dpr, E ? E.n : 8, { pausa: true });
  posicionarPausa();
  if (sel) mostrarSelecao();
}

// ------------------------------------------------------------------ prints, cena fixa e video (so local)
/** Joga N jogadas do bot na hora (sem animar). @param {number} n */
function preJogar(n) {
  const rng = criarRng(sementeBase * 13 + 1);
  for (let k = 0; k < n && !E.fim; k++) {
    const j = escolherJogada(E, { rng, ruido: 30 });
    if (!j) break;
    aplicarJogada(E, j);
  }
  if (E.fim) { novaPartida(); preJogar(Math.floor(n / 2)); return; }
  cena.reiniciar();
  cena.fixarPlacar(E.pontos);
  cena.atualizar(1.2);
  recalcular();
}

/** Cena parada: uma peca no ar sobre o melhor lugar, com a previa acesa. */
function montarFixo() {
  const j = escolherJogada(E);
  if (!j || j.tipo !== 'colocar') return;
  for (let k = 0; k < j.giros; k++) girar(E, j.slot);
  const p = /** @type {any} */ (E.bandeja[j.slot]);
  const c = centroNaCasa(p, j.gx, j.gy);
  const L = cena.L;
  S.arrasto = { slot: j.slot, peca: p, fx: c.x + L.cs * 0.12, fy: c.y - L.cs * 0.22, x: c.x + L.cs * 0.12, y: c.y - L.cs * 0.22, moveu: true, cresce: 1, alvo: null, previa: null, pid: -1 };
  calcularAlvo(S.arrasto);
  recalcular();
}

/** Quadros de um video sem relogio real, em <pre id="filme"> (tools/video.mjs). */
function gravarFilme() {
  const fps = dep.filme;
  const passos = Math.max(1, Math.round(1 / (fps * PASSO)));
  const total = Math.round((dep.dur / 1000) * fps);
  const esc = Math.min(1, dep.larg / canvas.clientWidth);
  const off = document.createElement('canvas');
  off.width = Math.round(canvas.clientWidth * esc);
  off.height = Math.round(canvas.clientHeight * esc);
  const octx = /** @type {CanvasRenderingContext2D} */ (off.getContext('2d'));
  const quadros = [];
  for (let i = 0; i < total; i++) {
    for (let s = 0; s < passos; s++) passo(PASSO);
    desenhar();
    octx.drawImage(canvas, 0, 0, off.width, off.height);
    quadros.push(off.toDataURL('image/jpeg', 0.88));
  }
  const pre = document.createElement('pre');
  pre.id = 'filme';
  pre.hidden = true;
  pre.textContent = quadros.join('\n');
  document.body.appendChild(pre);
  document.title = 'filme ' + quadros.length;
}

// ------------------------------------------------------------------ inicio
async function iniciar() {
  try { await document.fonts.load('700 24px Fredoka'); } catch { /* segue com a fonte do sistema */ }
  redimensionar();
  carregarPartida();
  redimensionar();
  if (dep.pre > 0) preJogar(dep.pre);
  if (dep.fixo) montarFixo();
  aplicarTextos();
  new ResizeObserver(() => redimensionar()).observe(palco);
  window.addEventListener('resize', posicionarPausa);
  // um quadro ja desenhado enquanto a SDK conversa com o portal (o laco vem depois)
  desenhar();
  const carregando = document.getElementById('carregando');
  if (carregando) carregando.remove();
  if (dep.ganchos) {
    /** @type {any} */ (window).__jogo = {
      get E() { return E; }, S, cena, audio, musica, portal, prefs,
      get jogou() { return jogou; }, get emAnuncio() { return emAnuncio; }, get anuncioNaTela() { return anuncioNaTela; },
      get pausaPortal() { return pausaPortal; },
      get menuAberto() { return menuAberto; }, get fimAberto() { return fimAberto; }, get lang() { return lang; },
      get t() { return cena.t; },
      /** jogada do bot na hora (roteiros) */
      bot() { const j = escolherJogada(E); if (j) processar(aplicarJogada(E, j)); return !!j; },
      /** forca o fim de jogo (roteiros): enche o tabuleiro e esvazia a bandeja menos uma peca que nao cabe */
      encerrar() {
        for (let i = 0; i < E.t.cor.length; i++) if (!E.t.cor[i]) E.t.cor[i] = 1;
        E.fim = true;
        processar([{ tipo: 'fim' }]);
      },
    };
  }
  if (dep.filme) {
    gravarFilme();
    return;
  }
  // portal sem handshake curto (Y8: o SDK async pode demorar ou faltar): o jogo ja anda enquanto o init espera
  if (!portal.lacoAposInit) {
    musica.iniciar();
    laco.iniciar();
  }
  await portal.init();
  // o idioma do portal so e certo depois do handshake
  const l = idiomaAgora();
  if (l !== lang) { lang = l; aplicarTextos(); }
  portal.gameLoadingFinished();
  musica.iniciar();
  laco.iniciar();
}

iniciar();

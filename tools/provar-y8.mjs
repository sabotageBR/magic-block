// Prova da build da Y8 (dist-y8/jogo/, de npm run empacotar:y8) num Chrome headless pelo CDP (tools/cdp.mjs),
// servida por um servidor estatico numa porta livre. O cdn.y8.com vai para 127.0.0.1:9 nos dois cenarios
// (--host-resolver-rules): nenhum pedido sai para a Y8 de verdade.
// a) SDK bloqueado (como um bloqueador de anuncio): o jogo carrega em menos de 3 s, arrastar uma peca
//    funciona, nenhum erro de JS no console, o Reviver com video nao aparece e "Jogar de novo" segue sem anuncio;
// b) SDK falso no lugar do y8.min.js (o CDP responde o pedido ao CDN com Fetch.fulfillRequest): window.y8 com
//    sdk() que devolve init, getPlatformLocale e showAd e emite y8sdk.ready. Confere: o init recebe os ids do
//    package.json; o idioma vem do getPlatformLocale; o intersticial so e pedido logo depois do clique num
//    botao e no maximo 1 a cada 180 s (o relogio da pagina e adiantado pela prova); o jogo congela e cala so no
//    beforeAd e volta no afterAd; break pulado nao cala; o Reviver so acontece com adViewed; perder o foco
//    (blur ou aba oculta) abre a pausa.
// Uso: node tools/provar-y8.mjs   (sai com codigo 1 se algum item falhar)
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, servir } from './servir.mjs';
import { abrirChrome, espera } from './cdp.mjs';

const ARVORE = join(RAIZ, 'dist-y8', 'jogo');
const { kit } = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const IDS = kit.ids.y8;
const BLOQUEIO = '--host-resolver-rules=MAP cdn.y8.com 127.0.0.1:9';

/** Relogio adiantavel (Date.now, o do limite de 180 s) e o registro dos cliques em botao. */
const PREPARO = `(() => {
  const real = Date.now;
  let desloc = 0;
  Date.now = () => real.call(Date) + desloc;
  window.__adiantar = (ms) => { desloc += ms; };
  window.__cliques = [];
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button') : null;
    window.__cliques.push({ id: b ? b.id : '', t: performance.now() });
  }, true);
})();`;

/** O SDK falso servido no lugar do y8.min.js: a prova decide cada callback do showAd. */
const SDK_FALSO = `(function () {
  var y = window.__y8 = { chamadas: [], pedidos: [], mostrou: 0 };
  var sdk = {
    init: function (app, ad) { y.chamadas.push({ ev: 'init', app: app, ad: ad, t: performance.now() }); },
    getPlatformLocale: function () { y.chamadas.push({ ev: 'locale', t: performance.now() }); return Promise.resolve('es'); },
    showAd: function (p) { y.chamadas.push({ ev: 'showAd', tipo: p.type, t: performance.now() }); y.pedidos.push(p); }
  };
  window.y8 = { sdk: function () { return sdk; }, emitReadyEvent: function () { dispatchEvent(new Event('y8sdk.ready')); } };
  dispatchEvent(new Event('y8sdk.ready'));
})();`;

/** @returns {Promise<number>} */
const portaLivre = () => new Promise((ok, falha) => {
  const s = createServer();
  s.on('error', falha);
  s.listen(0, '127.0.0.1', () => {
    const p = /** @type {any} */ (s.address()).port;
    s.close(() => ok(p));
  });
});

/** @type {{ cenario: string, item: string, ok: boolean, detalhe: string }[]} */
const itens = [];
/** @param {string} cenario @param {string} item @param {boolean} ok @param {string} [detalhe] */
function anotar(cenario, item, ok, detalhe = '') {
  itens.push({ cenario, item, ok, detalhe });
  process.stdout.write(`${ok ? 'OK   ' : 'FALHA'} [${cenario}] ${item}${detalhe ? ` (${detalhe})` : ''}\n`);
}

/** @param {any} c */
function ajudantes(c) {
  /** @param {string} expr @param {number} [ms] */
  async function esperarAte(expr, ms = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { if (await c.avaliar(expr)) return true; } catch { /* a pagina ainda carrega */ }
      await espera(50);
    }
    return false;
  }
  /** Clica no centro de um botao pelo id (clique de verdade, pelo CDP). @param {string} id */
  async function clicarBotao(id) {
    const r = await c.avaliar(`(() => { const b = document.getElementById('${id}'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!r) throw new Error(`botao ${id} nao esta na tela`);
    await c.clicar(r.x, r.y);
  }
  /** Arrasta (mouse de verdade) uma peca da bandeja ate um lugar livre perto do meio; true se a jogada entrou. */
  async function arrastarPeca() {
    const a = await c.avaliar(`(() => { const j = window.__jogo; const E = j.E; const t = E.t; const n = t.n; const L = j.cena.L;
      const r = document.getElementById('tela').getBoundingClientRect();
      let melhor = null;
      E.bandeja.forEach((p, k) => {
        if (!p) return;
        const w = Math.max(...p.cels.map((c) => c[0])) + 1; const h = Math.max(...p.cels.map((c) => c[1])) + 1;
        for (let gy = 0; gy + h <= n; gy++) for (let gx = 0; gx + w <= n; gx++) {
          if (!p.cels.every(([cx, cy]) => !t.cor[(gy + cy) * n + gx + cx])) continue;
          const d = Math.hypot(gx + w / 2 - n / 2, gy + h / 2 - n / 2);
          if (!melhor || d < melhor.d) melhor = { d, k, x: L.tab.x + (gx + w / 2) * L.cs, y: L.tab.y + (gy + h / 2) * L.cs };
        }
      });
      if (!melhor) return null;
      const o = j.cena.centroVaga(melhor.k);
      return { jogadas: E.jogadas, x0: r.left + o.x, y0: r.top + o.y, x1: r.left + melhor.x, y1: r.top + melhor.y }; })()`);
    if (!a) return false;
    await c.arrastar(a.x0, a.y0, a.x1, a.y1, 12, 360);
    await espera(150);
    return (await c.avaliar('window.__jogo.E.jogadas')) === a.jogadas + 1;
  }
  /** O relogio da cena anda? (o laco nao esta congelado) */
  async function cenaAnda(ms = 300) {
    const t0 = await c.avaliar('window.__jogo.t');
    await espera(ms);
    return (await c.avaliar('window.__jogo.t')) > t0;
  }
  const audio = () => c.avaliar('window.__jogo.audio.estado()');
  const anuncios = () => c.avaliar("window.__y8 ? window.__y8.chamadas.filter((x) => x.ev === 'showAd').length : 0");
  /** Fim de jogo forcado (gancho local) e espera o painel. */
  async function encerrar() {
    await c.avaliar('window.__jogo.encerrar()');
    return esperarAte('window.__jogo.fimAberto', 4000);
  }
  return { esperarAte, clicarBotao, arrastarPeca, cenaAnda, audio, anuncios, encerrar };
}

/** @param {number} porta @param {boolean} falso */
async function abrir(porta, falso) {
  const c = await abrirChrome({ porta: await portaLivre(), args: [BLOQUEIO] });
  /** @type {string[]} */
  const rede = [];
  await c.cmd('Log.enable');
  c.aoEvento('Log.entryAdded', (p) => { if (p.entry.level === 'error') rede.push(`${p.entry.source}: ${p.entry.text} ${p.entry.url || ''}`.trim()); });
  /** @type {string[]} todo pedido que nao e da build local nem data: */
  const externos = [];
  await c.cmd('Network.enable');
  c.aoEvento('Network.requestWillBeSent', (p) => {
    const u = p.request.url;
    if (!/^(data:|blob:|http:\/\/127\.0\.0\.1:)/.test(u)) externos.push(u);
  });
  /** @type {string[]} */
  const servidos = [];
  if (falso) {
    c.aoEvento('Fetch.requestPaused', (p) => {
      servidos.push(p.request.url);
      c.cmd('Fetch.fulfillRequest', {
        requestId: p.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from(SDK_FALSO).toString('base64'),
      });
    });
    await c.cmd('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.y8.com/*' }] });
  }
  await c.cmd('Page.addScriptToEvaluateOnNewDocument', { source: PREPARO });
  const t0 = Date.now();
  await c.cmd('Page.navigate', { url: `http://127.0.0.1:${porta}/index.html` });
  return { c, rede, servidos, externos, t0 };
}

/** Nenhum pedido externo alem do SDK da Y8. @param {string} cenario @param {string[]} externos */
function conferirExternos(cenario, externos) {
  const alheios = [...new Set(externos)].filter((u) => u !== 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js');
  anotar(cenario, 'nenhum pedido externo alem do SDK da Y8', alheios.length === 0, alheios.join(' | ') || `${new Set(externos).size} externo(s): so o y8.min.js`);
}

// ------------------------------------------------------------------ a) SDK bloqueado
async function cenarioA(porta) {
  const A = 'a: SDK bloqueado';
  const { c, rede, externos, t0 } = await abrir(porta, false);
  const h = ajudantes(c);
  try {
    const pronto = await h.esperarAte("window.__jogo && !document.getElementById('carregando') && window.__jogo.t > 0.2", 6000);
    const ms = Date.now() - t0;
    anotar(A, 'carrega e o laco anda em menos de 3 s', pronto && ms < 3000, `${ms} ms`);
    // (a fila marca sdkPronto quando o init responde, e rejeitar tambem e resposta: quem decide e o temAnuncios)
    anotar(A, 'o onerror da tag avisou e nao ha anuncio nem video', (await c.avaliar('window.__sdkFalhou === 1 && !window.__jogo.portal.temAnuncios && !window.__jogo.portal.temVideo')) === true);
    anotar(A, 'idioma padrao em ingles', (await c.avaliar('window.__jogo.lang')) === 'en');
    anotar(A, 'arrastar uma peca coloca a peca', await h.arrastarPeca());
    anotar(A, 'a cena anda depois da jogada', await h.cenaAnda());
    anotar(A, 'fim de jogo abre o painel', await h.encerrar());
    anotar(A, 'o Reviver com video nao aparece', (await c.avaliar("document.getElementById('btnReviver').hidden")) === true);
    await h.clicarBotao('btnDeNovo');
    const nova = await h.esperarAte('!window.__jogo.fimAberto && !window.__jogo.E.fim && window.__jogo.E.jogadas === 0 && !window.__jogo.emAnuncio', 1500);
    anotar(A, '"Jogar de novo" comeca outra partida na hora, sem anuncio', nova);
    anotar(A, 'arrastar funciona na partida nova', await h.arrastarPeca());
    anotar(A, 'nenhum erro de JS no console', c.erros.length === 0, c.erros.join(' | '));
    const alheios = rede.filter((r) => !/cdn\.y8\.com/.test(r));
    anotar(A, 'no log so o erro de rede do SDK bloqueado', alheios.length === 0, rede.join(' | ') || 'nenhum');
    conferirExternos(A, externos);
  } finally {
    await c.fechar();
  }
}

// ------------------------------------------------------------------ b) SDK falso
async function cenarioB(porta) {
  const B = 'b: SDK falso';
  const { c, servidos, externos, t0 } = await abrir(porta, true);
  const h = ajudantes(c);
  /** Ultimo pedido do showAd (o objeto com os callbacks) fica em window.__y8.pedidos. */
  const ultimo = 'window.__y8.pedidos[window.__y8.pedidos.length - 1]';
  /** showAd logo depois do clique no botao: o pedido saiu em ate 100 ms do ultimo clique, e nele. @param {string} id */
  const logoDepoisDoClique = (id) => c.avaliar(`(() => { const a = window.__y8.chamadas.filter((x) => x.ev === 'showAd').pop();
    const k = window.__cliques[window.__cliques.length - 1]; return !!a && !!k && k.id === '${id}' && a.t >= k.t && a.t - k.t < 100; })()`);
  try {
    const pronto = await h.esperarAte("window.__jogo && !document.getElementById('carregando') && window.__jogo.t > 0.2 && window.__jogo.portal.sdkPronto", 6000);
    anotar(B, 'carrega com o SDK pronto', pronto, `${Date.now() - t0} ms; servido no lugar de ${servidos.join(', ') || 'nada'}`);
    const init = await c.avaliar("window.__y8.chamadas.find((x) => x.ev === 'init')");
    anotar(B, 'init recebe appId e gameId do package.json', !!init && init.app.appId === IDS.appId && init.ad && init.ad.gameId === IDS.gameId,
      init ? `appId ${init.app.appId}, gameId ${init.ad && init.ad.gameId}, autoLogin ${init.app.autoLogin}` : 'sem init');
    anotar(B, 'idioma pelo getPlatformLocale (es)', await h.esperarAte("window.__jogo.lang === 'es'", 2000));
    anotar(B, 'sem pedido de anuncio na abertura', (await h.anuncios()) === 0);

    // 1) jogar, morrer: nada automatico; "Jogar de novo" antes de 180 s nao pede (pre-roll da Y8 conta)
    anotar(B, 'arrastar uma peca coloca a peca', await h.arrastarPeca());
    await h.encerrar();
    await espera(1500);
    anotar(B, 'fim de jogo nao pede intersticial sozinho', (await h.anuncios()) === 0);
    anotar(B, 'o Reviver com video aparece com o SDK pronto', (await c.avaliar("!document.getElementById('btnReviver').hidden")) === true);
    await h.clicarBotao('btnDeNovo');
    await h.esperarAte('!window.__jogo.fimAberto && window.__jogo.E.jogadas === 0', 1500);
    anotar(B, '"Jogar de novo" antes de 180 s da abertura: sem intersticial', (await h.anuncios()) === 0);

    // 2) 181 s depois: "Jogar de novo" pede o intersticial logo depois do clique; congela e cala so no beforeAd
    await c.avaliar('window.__adiantar(181000)');
    await h.arrastarPeca();
    await h.encerrar();
    await espera(800);
    anotar(B, 'fim de jogo (181 s depois) ainda nao pede nada sem clique', (await h.anuncios()) === 0);
    await h.clicarBotao('btnDeNovo');
    await espera(120);
    anotar(B, '"Jogar de novo" pede showAd({type:\'next\'}) logo depois do clique', (await h.anuncios()) === 1 && await logoDepoisDoClique('btnDeNovo'));
    anotar(B, 'o pedido usa o tipo next', (await c.avaliar(`${ultimo}.type`)) === 'next');
    const antes = await h.audio();
    anotar(B, 'antes do beforeAd o jogo nao congela nem cala', await h.cenaAnda() && !antes.emAnuncio && antes.contexto === 'running' && !(await c.avaliar('window.__jogo.anuncioNaTela')),
      `audio ${antes.contexto}, ganho ${antes.ganhoMestre}`);
    await c.avaliar(`${ultimo}.beforeAd()`);
    await espera(200);
    const durante = await h.audio();
    anotar(B, 'no beforeAd o jogo congela', !(await h.cenaAnda()) && (await c.avaliar('window.__jogo.anuncioNaTela')) === true);
    anotar(B, 'no beforeAd o jogo cala (mestre 0, contexto suspenso: musica e efeitos)', durante.emAnuncio && durante.ganhoMestre === 0 && durante.contexto === 'suspended',
      `audio ${durante.contexto}, ganho ${durante.ganhoMestre}`);
    await c.avaliar(`${ultimo}.afterAd()`);
    await h.esperarAte('!window.__jogo.emAnuncio', 1500);
    await espera(200);
    const depois = await h.audio();
    anotar(B, 'no afterAd o jogo volta (anda e toca) numa partida nova', await h.cenaAnda() && !depois.emAnuncio && depois.contexto === 'running'
      && (await c.avaliar('!window.__jogo.fimAberto && !window.__jogo.E.fim && window.__jogo.E.jogadas === 0')) === true, `audio ${depois.contexto}`);
    await c.avaliar(`${ultimo}.adBreakDone({ breakStatus: 'viewed' })`);

    // 3) "Recomecar" (menu de pausa) logo depois: dentro de 180 s, sem intersticial
    await h.arrastarPeca();
    await h.clicarBotao('btnPausa');
    await h.esperarAte('window.__jogo.menuAberto', 1000);
    await h.clicarBotao('btnRecomecar');
    await h.esperarAte('!window.__jogo.menuAberto && window.__jogo.E.jogadas === 0', 1500);
    anotar(B, '"Recomecar" 1 s depois do anterior: sem intersticial (no maximo 1 a cada 180 s)', (await h.anuncios()) === 1);

    // 4) mais 181 s: "Recomecar" pede; break pulado (adBreakDone sem beforeAd) nao congela nem cala
    await c.avaliar('window.__adiantar(181000)');
    await h.arrastarPeca();
    await h.clicarBotao('btnPausa');
    await h.esperarAte('window.__jogo.menuAberto', 1000);
    await h.clicarBotao('btnRecomecar');
    await espera(120);
    anotar(B, '"Recomecar" pede o intersticial logo depois do clique', (await h.anuncios()) === 2 && await logoDepoisDoClique('btnRecomecar'));
    const pulado = await h.cenaAnda();
    await c.avaliar(`${ultimo}.adBreakDone({ breakStatus: 'frequencyCapped' })`);
    await h.esperarAte('!window.__jogo.emAnuncio', 1500);
    const aPulado = await h.audio();
    anotar(B, 'break pulado: o jogo nao congelou nem calou e a partida nova comeca', pulado && !aPulado.emAnuncio && aPulado.contexto === 'running'
      && (await c.avaliar('window.__jogo.E.jogadas === 0 && !window.__jogo.anuncioNaTela')) === true);

    // 5) premiado recusado: o video fechado nao revive
    await h.arrastarPeca();
    await h.encerrar();
    await h.clicarBotao('btnReviver');
    await espera(120);
    anotar(B, '"Reviver" pede showAd({type:\'reward\'}) logo depois do clique', (await h.anuncios()) === 3 && await logoDepoisDoClique('btnReviver')
      && (await c.avaliar(`${ultimo}.type`)) === 'reward');
    await c.avaliar(`${ultimo}.beforeReward(() => { window.__y8.mostrou++; })`);
    anotar(B, 'o jogo aceita o premiado na hora (o jogador ja clicou)', (await c.avaliar('window.__y8.mostrou')) === 1);
    await c.avaliar(`${ultimo}.beforeAd()`);
    await espera(200);
    const aPremio = await h.audio();
    anotar(B, 'premiado: congela e cala no beforeAd', !(await h.cenaAnda()) && aPremio.emAnuncio && aPremio.ganhoMestre === 0);
    await c.avaliar(`(() => { const p = ${ultimo}; p.adDismissed(); p.afterAd(); p.adBreakDone({ breakStatus: 'dismissed' }); })()`);
    await h.esperarAte('!window.__jogo.emAnuncio', 1500);
    await espera(150);
    anotar(B, 'video fechado (sem adViewed): nao revive, avisa e esconde o botao', (await c.avaliar(`window.__jogo.fimAberto && window.__jogo.E.fim && window.__jogo.E.revividas === 0
      && document.getElementById('btnReviver').hidden && !document.getElementById('fimAviso').hidden`)) === true);
    anotar(B, 'depois do premiado o som volta', (await h.audio()).contexto === 'running');

    // 6) premiado visto: so com adViewed revive (outra partida; "Jogar de novo" dentro de 180 s nao pede)
    await h.clicarBotao('btnDeNovo');
    await h.esperarAte('!window.__jogo.fimAberto && window.__jogo.E.jogadas === 0', 1500);
    anotar(B, '"Jogar de novo" dentro de 180 s do ultimo: sem intersticial', (await h.anuncios()) === 3);
    await h.arrastarPeca();
    await h.encerrar();
    await h.clicarBotao('btnReviver');
    await espera(120);
    await c.avaliar(`(() => { const p = ${ultimo}; p.beforeReward(() => {}); p.beforeAd(); })()`);
    await espera(150);
    anotar(B, 'antes do adViewed ainda nao reviveu', (await c.avaliar('window.__jogo.E.fim && window.__jogo.E.revividas === 0')) === true);
    await c.avaliar(`(() => { const p = ${ultimo}; p.adViewed(); p.afterAd(); p.adBreakDone({ breakStatus: 'viewed' }); })()`);
    const reviveu = await h.esperarAte('!window.__jogo.fimAberto && !window.__jogo.E.fim && window.__jogo.E.revividas === 1', 1500);
    anotar(B, 'com adViewed revive (painel fecha, a partida continua)', reviveu);
    anotar(B, 'depois de reviver o jogo anda e toca', await h.cenaAnda() && (await h.audio()).contexto === 'running');
    anotar(B, 'arrastar funciona depois de reviver', await h.arrastarPeca());

    // 7) perder o foco abre a pausa, sem pedir anuncio
    const pedidos = await h.anuncios();
    await c.avaliar("window.dispatchEvent(new Event('blur'))");
    anotar(B, 'blur abre o menu de pausa', await h.esperarAte('window.__jogo.menuAberto', 1000));
    anotar(B, 'na pausa o jogo congela', !(await h.cenaAnda()));
    await h.clicarBotao('btnContinuar');
    await h.esperarAte('!window.__jogo.menuAberto', 1000);
    await c.avaliar(`(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange')); })()`);
    anotar(B, 'aba oculta abre o menu de pausa', await h.esperarAte('window.__jogo.menuAberto', 1000));
    await h.clicarBotao('btnContinuar');
    await h.esperarAte('!window.__jogo.menuAberto', 1000);
    anotar(B, 'foco e pausa nao pedem anuncio (4 pedidos ao todo: 2 next, 2 reward, todos depois de clique)', (await h.anuncios()) === pedidos && pedidos === 4
      && (await c.avaliar("window.__y8.chamadas.filter((x) => x.ev === 'showAd').map((x) => x.tipo).join()")) === 'next,next,reward,reward');
    anotar(B, 'nenhum erro de JS no console', c.erros.length === 0, c.erros.join(' | '));
    conferirExternos(B, externos);
  } finally {
    await c.fechar();
  }
}

if (!existsSync(join(ARVORE, 'index.html'))) {
  process.stdout.write('falta dist-y8/jogo/: rode antes npm run empacotar:y8\n');
  process.exit(1);
}
const porta = await portaLivre();
const fechar = await servir(porta, '127.0.0.1', ARVORE);
process.stdout.write(`build da Y8 servida em http://127.0.0.1:${porta}/\n`);
try {
  await cenarioA(porta);
  await cenarioB(porta);
} finally {
  await fechar();
}
const falhas = itens.filter((i) => !i.ok);
process.stdout.write(`\n${itens.length - falhas.length}/${itens.length} itens OK\n`);
process.exit(falhas.length ? 1 : 0);

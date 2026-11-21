// Build da Y8: o adaptador (src/core/portais/y8.js sobre fila-sdk.js, copiados do kit multiportal) com um
// SDK falso, e o empacotador (tools/empacotar.mjs) montando as arvores da Y8 e do californiagames.io numa
// pasta temporaria: a troca da camada e da tag, os ids e o que cada zip leva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarPortalY8 } from '../src/core/portais/y8.js';
import { ALVOS, montar } from '../tools/empacotar.mjs';

/** @param {{ viu?: boolean, pulado?: boolean }} [o] */
function y8Falso({ viu = true, pulado = false } = {}) {
  /** @type {Record<string, Function[]>} */
  const ouvintes = {};
  const janela = { addEventListener: (/** @type {string} */ ev, /** @type {Function} */ fn) => { (ouvintes[ev] ||= []).push(fn); } };
  /** @type {string[]} */
  const log = [];
  const sdkObj = {
    init: (/** @type {any} */ a, /** @type {any} */ b) => log.push(`init:${a.appId}:${b && b.gameId}`),
    getPlatformLocale: () => Promise.resolve('es'),
    showAd: (/** @type {any} */ p) => {
      log.push(`showAd:${p.type}`);
      if (pulado) { p.adBreakDone({ breakStatus: 'frequencyCapped' }); return; }
      p.beforeAd();
      if (p.type === 'reward') p.beforeReward(() => { if (viu) p.adViewed(); else p.adDismissed(); });
      p.afterAd();
      p.adBreakDone({ breakStatus: 'viewed' });
    },
  };
  const y8 = { sdk: () => sdkObj, emitReadyEvent: () => (ouvintes['y8sdk.ready'] || []).forEach((f) => f()) };
  return { janela, y8, log, ouvintes };
}
const IDS = { appId: 'a1', gameId: 'g1' };

test('y8: sem appId o SDK nao inicia e nao ha video', async () => {
  const f = y8Falso();
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: {}, janela: f.janela });
  await p.init();
  assert.equal(p.sdkPronto, false);
  assert.equal(p.temAnuncios, false);
  assert.equal(f.log.length, 0);
});

test('y8: SDK bloqueado (onerror da tag) segue na hora, sem anuncio nem video', async () => {
  const f = y8Falso();
  const ja = criarPortalY8({ obterSdk: () => undefined, ids: IDS, janela: { ...f.janela, __sdkFalhou: 1 } });
  const t0 = Date.now();
  await ja.init();
  assert.ok(Date.now() - t0 < 500);
  assert.equal(ja.temAnuncios, false);
  ja.gameplayStart();
  assert.equal(await ja.commercialBreak(), false);
  assert.equal(await ja.rewardedBreak(), false, 'sem SDK, sem premio');
  const g = y8Falso();
  const depois = criarPortalY8({ obterSdk: () => undefined, ids: IDS, janela: g.janela });
  const t1 = Date.now();
  const pronto = depois.init();
  setTimeout(() => (g.ouvintes['y8sdk.falhou'] || []).forEach((fn) => fn()), 20);
  await pronto;
  assert.ok(Date.now() - t1 < 500);
  assert.equal(depois.temAnuncios, false);
});

test('y8: init com os ids, idioma do subdominio e as marcas que o main.js le', async () => {
  const f = y8Falso();
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: IDS, janela: f.janela });
  await p.init();
  assert.equal(p.sdkPronto, true);
  assert.deepEqual(f.log, ['init:a1:g1']);
  assert.equal(p.idioma, 'es');
  assert.equal(p.temAnuncios, true);
  const marcas = /** @type {any} */ (p);
  assert.equal(marcas.intervaloSoNoClique, true);
  assert.equal(marcas.pausaNoBlur, true);
  assert.equal(marcas.pausaSoNoAnuncio, true);
  assert.equal(marcas.lacoAposInit, false, 'o laco nao espera o SDK async');
});

test('y8: cala so no beforeAd; break pulado nao cala; premio so no adViewed; nada antes de jogar', async () => {
  const f = y8Falso();
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: IDS, janela: f.janela });
  /** @type {string[]} */
  const ev = [];
  p.onAdStart = () => ev.push('cala');
  p.onAdEnd = () => ev.push('volta');
  await p.init();
  assert.equal(await p.commercialBreak(), false, 'antes do primeiro gameplayStart nao ha intervalo');
  p.gameplayStart();
  assert.equal(await p.commercialBreak(), true);
  assert.deepEqual(ev, ['cala', 'volta']);
  assert.equal(await p.rewardedBreak('medium'), true);
  assert.deepEqual(f.log.slice(1), ['showAd:next', 'showAd:reward']);
  const g = y8Falso({ pulado: true });
  const q = criarPortalY8({ obterSdk: () => g.y8, ids: IDS, janela: g.janela });
  /** @type {string[]} */
  const ev2 = [];
  q.onAdStart = () => ev2.push('cala');
  await q.init();
  q.gameplayStart();
  await q.commercialBreak();
  assert.deepEqual(ev2, [], 'break pulado pelo limite de frequencia nao cala o jogo');
  assert.equal(await q.rewardedBreak(), false, 'break pulado nao premia');
  const h = y8Falso({ viu: false });
  const r = criarPortalY8({ obterSdk: () => h.y8, ids: IDS, janela: h.janela });
  await r.init();
  assert.equal(await r.rewardedBreak(), false, 'fechou o video: sem premio');
});

test('empacotar --alvo=y8: camada da Y8, tag do CDN com onerror, ids do package.json e nada do californiagames', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'magicblock-y8-'));
  try {
    const m = montar('y8', { arvore: pasta });
    assert.deepEqual(m.falhas, []);
    const html = readFileSync(join(pasta, 'index.html'), 'utf8');
    const cabeca = html.split('</head>')[0];
    assert.ok(cabeca.includes(ALVOS.y8.tag));
    assert.ok(ALVOS.y8.tag.includes(' async ') && ALVOS.y8.tag.includes("dispatchEvent(new Event('y8sdk.falhou'))"));
    assert.ok(!/plataforma-sdk|PlataformaSDK|californiagames/i.test(html));
    const plat = readFileSync(join(pasta, 'src/core/plataforma.js'), 'utf8');
    assert.match(plat, /export \{ portal \} from '\.\/portais\/y8\.js';/);
    assert.ok(!/criarCalifornia/.test(plat), 'a camada do californiagames.io nao vai');
    const { kit } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const y8 = readFileSync(join(pasta, 'src/core/portais/y8.js'), 'utf8');
    assert.ok(y8.includes(`export const IDS = ${JSON.stringify({ appId: kit.ids.y8.appId, gameId: kit.ids.y8.gameId })};`));
    assert.equal(m.semId, false);
    assert.ok(existsSync(join(pasta, 'src/core/portais/fila-sdk.js')));
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('empacotar (californiagames): a camada e a tag de sempre, sem a pasta portais/ da Y8', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'magicblock-cg-'));
  try {
    const m = montar('californiagames', { arvore: pasta });
    assert.deepEqual(m.falhas, []);
    assert.equal(readFileSync(join(pasta, 'index.html'), 'utf8'), readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
    assert.equal(readFileSync(join(pasta, 'src/core/plataforma.js'), 'utf8'), readFileSync(new URL('../src/core/plataforma.js', import.meta.url), 'utf8'));
    assert.ok(!existsSync(join(pasta, 'src/core/portais')));
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

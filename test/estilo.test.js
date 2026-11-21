// Fronteiras do codigo (ver CLAUDE.md), adaptadas do tic-tac-toe-deluxe, mais o contrato dos temas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
/** @param {string} dir @returns {string[]} */
const arquivos = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? (n === 'prints' ? [] : arquivos(p)) : [p];
});
const src = arquivos(join(raiz, 'src')).filter((p) => /\.(js|css)$/.test(p));
const modelos = arquivos(join(raiz, 'modelos')).filter((p) => /\.(js|html)$/.test(p));
const codigo = [...src, ...modelos.filter((p) => p.endsWith('.js'))];
const ler = (/** @type {string} */ p) => readFileSync(p, 'utf8');
const rel = (/** @type {string} */ p) => relative(raiz, p);
/** @param {string} t */
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('sem console.log/info/debug no jogo nem nos modelos', () => {
  for (const p of codigo) assert.ok(!/console\.(log|info|debug)\s*\(/.test(ler(p)), rel(p));
});

test('so o armazenamento toca o localStorage, com o prefixo do jogo e sem clear()', () => {
  for (const p of codigo) {
    if (rel(p) === 'src/core/armazenamento.js') continue;
    assert.ok(!/localStorage|sessionStorage|indexedDB/.test(ler(p)), rel(p));
  }
  const a = ler(join(raiz, 'src/core/armazenamento.js'));
  assert.ok(/PREFIXO_PADRAO = 'magicblock\.'/.test(a));
  assert.ok(!/\.clear\(/.test(a));
});

test('logica pura (src/jogo) nao usa Math.random, DOM nem relogio', () => {
  for (const p of src.filter((x) => /src\/jogo\//.test(x))) {
    const t = semComentarios(ler(p));
    assert.ok(!/Math\.random|document\.|window\.|Date\.now|performance\.now|setTimeout/.test(t), rel(p));
  }
});

test('src/jogo so importa src/jogo e core/rng.js', () => {
  for (const p of src.filter((x) => /src\/jogo\//.test(x))) {
    for (const [, alvo] of ler(p).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const r = rel(join(p, '..', alvo));
      assert.ok(/^src\/jogo\//.test(r) || r === 'src/core/rng.js', `${rel(p)} importa ${r}`);
    }
  }
});

test('src/jogo em ASCII fora dos comentarios (texto com acento fica fora do nucleo)', () => {
  for (const p of src.filter((x) => /src\/jogo\//.test(x))) {
    assert.ok(!/[^\x00-\x7f]/.test(semComentarios(ler(p))), rel(p));
  }
});

test('nenhuma URL absoluta no codigo nem nas paginas dos modelos', () => {
  for (const p of [...codigo, ...modelos]) {
    const urls = semComentarios(ler(p)).match(/https?:\/\/[^\s"'`)<>]+/g) || [];
    assert.deepEqual(urls.filter((u) => !u.startsWith('http://127.0.0.1')), [], rel(p));
  }
});

test('nenhuma marca de outro portal no codigo', () => {
  for (const p of codigo) assert.ok(!/poki|crazygames/i.test(semComentarios(ler(p))), rel(p));
});

test('jogar.html pede viewport-fit=cover', () => {
  assert.ok(/viewport-fit=cover/.test(ler(join(raiz, 'modelos/jogar.html'))));
});

test('os 6 temas cumprem o contrato da cena', async () => {
  const { TEMAS, NOMES_MEC } = await import('../modelos/temas/index.js');
  const { MECANICAS } = await import('../src/jogo/regras.js');
  assert.equal(TEMAS.length, 6);
  assert.equal(NOMES_MEC.length, MECANICAS.length);
  const ids = new Set();
  TEMAS.forEach((t, k) => {
    assert.ok(t.id && !ids.has(t.id), 'id ' + k);
    ids.add(t.id);
    assert.equal(t.mec, k + 1, t.id + ' mecanica padrao');
    assert.equal(t.cores.length, 6, t.id);
    for (const c of [...t.cores, t.entulho]) assert.match(c, /^#[0-9a-f]{6}$/i, t.id);
    for (const k2 of ['texto', 'suave', 'contorno', 'destaque']) assert.ok(t.hud[k2], `${t.id} hud.${k2}`);
    for (const k2 of ['fundo', 'borda', 'texto', 'botao']) assert.ok(t.painel[k2], `${t.id} painel.${k2}`);
    for (const f of ['fundo', 'tabuleiro', 'pintarBloco', 'limpar']) assert.equal(typeof t[f], 'function', `${t.id}.${f}`);
    assert.ok(typeof t.timbre.raiz === 'number', t.id + ' timbre');
  });
});

test('os sons que o prototipo toca existem para todo tema', async () => {
  const { TEMAS } = await import('../modelos/temas/index.js');
  const { criarSons } = await import('../src/som/sons.js');
  const usados = new Set([...ler(join(raiz, 'modelos/jogar.js')).matchAll(/tocar\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(usados.size >= 10);
  for (const t of TEMAS) {
    const sons = criarSons(t.timbre);
    for (const n of usados) assert.equal(typeof sons[n], 'function', `${t.id}: ${n}`);
  }
});

// ------------------------------------------------------------------ o jogo final (index.html + src/main.js)
const main = ler(join(raiz, 'src/main.js'));
const html = ler(join(raiz, 'index.html'));

test('so src/main.js importa a camada da SDK; ninguem fala com a PlataformaSDK fora dela', () => {
  for (const p of src) {
    if (rel(p) === 'src/main.js' || rel(p) === 'src/core/plataforma.js') continue;
    // src/core/portais/ (adaptador da Y8) e parte da camada: so a build da Y8 o liga (tools/empacotar.mjs)
    if (rel(p).startsWith('src/core/portais/')) {
      assert.ok(!/from '[^']*plataforma\.js'/.test(ler(p)), rel(p));
      assert.ok(!/PlataformaSDK/.test(semComentarios(ler(p))), rel(p));
      continue;
    }
    assert.ok(!/plataforma\.js/.test(ler(p)), rel(p));
    assert.ok(!/PlataformaSDK/.test(semComentarios(ler(p))), rel(p));
    assert.ok(!/portais\//.test(semComentarios(ler(p))), `${rel(p)} importa um adaptador direto`);
  }
  assert.ok(/from '\.\/core\/plataforma\.js'/.test(main));
  assert.ok(!/from '[^']*portais\//.test(main), 'o main.js fala so com core/plataforma.js');
});

test('so a depuracao le a URL no jogo; o idioma nunca vem do navegador', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/depuracao.js') continue;
    assert.ok(!/location\.(search|hash)|URLSearchParams/.test(ler(p)), rel(p));
    assert.ok(!/navigator\.languages?\b/.test(semComentarios(ler(p))), rel(p));
  }
});

test('gameplayStart so em jogadorAgiu, chamada so no pointerdown e no keydown', () => {
  const sem = semComentarios(main);
  assert.equal((sem.match(/gameplayStart\(\)/g) || []).length, 1);
  const corpo = sem.slice(sem.indexOf('function jogadorAgiu'), sem.indexOf('portal.gameplayStart()'));
  assert.ok(corpo.length > 0 && corpo.length < 300, 'gameplayStart fora de jogadorAgiu');
  const chamadas = [...sem.matchAll(/jogadorAgiu\(\);/g)].map((m) => sem.slice(Math.max(0, (m.index || 0) - 900), m.index));
  assert.ok(chamadas.length >= 2);
  for (const antes of chamadas) {
    const ultimo = Math.max(antes.lastIndexOf("addEventListener('pointerdown'"), antes.lastIndexOf("addEventListener('keydown'"));
    assert.ok(ultimo >= 0, 'jogadorAgiu fora do pointerdown/keydown');
  }
});

test('index.html: SDK relativa no <head> antes do jogo, viewport-fit=cover, sem URL absoluta', () => {
  const cabeca = html.split('</head>')[0];
  assert.ok(cabeca.includes('<script src="/sdk/v1/plataforma-sdk.js"></script>'));
  assert.ok(html.indexOf('/sdk/v1/plataforma-sdk.js') < html.indexOf('src/main.js'));
  assert.ok(/viewport-fit=cover/.test(html));
  assert.deepEqual(html.match(/https?:\/\/[^\s"'`)<>]+/g) || [], []);
  assert.ok(!/poki|crazygames/i.test(html));
});

test('textos nos tres idiomas (pt, en, es) com as mesmas chaves, e todo data-t existe', async () => {
  const { TEXTOS } = await import('../src/i18n/textos.js');
  const chaves = (/** @type {object} */ o) => Object.keys(o).sort().join('|');
  assert.deepEqual(Object.keys(TEXTOS).sort(), ['en', 'es', 'pt']);
  assert.equal(chaves(TEXTOS.en), chaves(TEXTOS.pt));
  assert.equal(chaves(TEXTOS.es), chaves(TEXTOS.pt));
  for (const [, k] of html.matchAll(/data-t="([^"]+)"/g)) assert.ok(TEXTOS.pt[k], k);
  for (const [, k] of main.matchAll(/\bT\('([^']+)'\)/g)) assert.ok(TEXTOS.pt[k], k);
});

test('os sons que o jogo toca existem e cada receita roda num contexto falso', async () => {
  const { SONS } = await import('../src/som/galaxia.js');
  const usados = new Set([...main.matchAll(/tocar\('(\w+)'/g)].map((m) => m[1]));
  assert.ok(usados.size >= 12);
  for (const n of usados) assert.equal(typeof SONS[n], 'function', n);
  // contexto falso: so conta os nos (a receita nao pode lancar e devolve a duracao)
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const no = () => ({ connect() {}, start() {}, stop() {}, frequency: param(), gain: param(), Q: param(), pan: param(), type: '', buffer: null, loop: false });
  const ctx = { currentTime: 0, sampleRate: 8000, createOscillator: no, createGain: no, createBiquadFilter: no, createStereoPanner: no, createBufferSource: no,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }) };
  for (const [nome, r] of Object.entries(SONS)) {
    const dur = r({ ctx, destino: no() }, 0, { k: 3, seq: 6, n: 5, dobro: true, giro: 2 });
    assert.ok(dur > 0 && dur < 6, `${nome}: ${dur}`);
  }
});

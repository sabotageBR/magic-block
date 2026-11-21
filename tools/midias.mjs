// Midias do californiagames.io a partir do BUILD empacotado (dist/, o mesmo que vai no zip), pelo Chrome
// headless (CDP, viewport emulado):
//   screenshot-01..05.png  gameplay real: paisagem 1280x720@1,5x (1920x1080) e retrato 540x960@2x
//                          (1080x1920); o bot do jogo (?auto) joga e o print sai logo depois de uma limpeza,
//                          ou a cena parada (?fixo) com uma peca no ar e a linha acesa
//   preview.mp4            12 s em 720x720, quadros gerados pelo proprio jogo sem relogio real (?filme),
//                          H.264 sem audio, a acao desde o primeiro segundo
//   thumb.png              1024x1024: o tabuleiro de um print sem HUD, inclinado, com o titulo
//   capa.png               1920x1080: print de paisagem desfocado ao fundo, titulo a esquerda e a arte a direita
//                          (so o nome do jogo, que vale nos tres idiomas)
// Saida: ../jogos/distribuicao/magic-block/californiagames/midias/ (e .tmp/midias/ com os quadros).
// Uso: npm run empacotar && node tools/midias.mjs
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { abrirChrome, espera } from './cdp.mjs';
import { servir } from './servir.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const DESTINO = join(RAIZ, '..', 'jogos', 'distribuicao', pacote.name, 'californiagames', 'midias');
const TMP = join(RAIZ, '.tmp/midias');
const PORTA = 5424;
const BASE = `http://127.0.0.1:${PORTA}`;
if (!existsSync(join(RAIZ, 'dist/index.html'))) throw new Error('rode npm run empacotar antes (falta dist/)');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(DESTINO, { recursive: true });

const fechar = await servir(PORTA);
const c = await abrirChrome({ largura: 1280, altura: 720, escala: 1.5, porta: 9397 });
const jogo = (q) => `${BASE}/dist/index.html?lang=pt&semanuncio&${q}&r=${Math.random()}`;
const salvar = async (nome) => { const p = join(TMP, nome); writeFileSync(p, await c.print()); return p; };

/** abre o jogo com o bot e tira o print logo depois de uma limpeza (com as particulas no ar) */
async function printDepoisDeLimpar(q, nome, minimo = 1, espera0 = 1500) {
  await c.ir(jogo(q), espera0);
  const ini = await c.avaliar('__jogo.E.limpezas');
  for (let k = 0; k < 120; k++) {
    await espera(60);
    const e = await c.avaliar('({ l: __jogo.E.limpezas, s: __jogo.E.seq, f: __jogo.E.fim })');
    if (e.f) break;
    if (e.l >= ini + minimo) { await espera(170); return salvar(nome); }
  }
  return salvar(nome);
}

try {
  // ---------------------------------------------------------------- screenshots
  const shots = [];
  await c.tamanho(1280, 720, 1.5);
  await c.ir(jogo('semente=31&pre=16&fixo'), 1800);
  shots.push(await salvar('s1-paisagem-fixo.png'));
  await c.tamanho(540, 960, 2);
  shots.push(await printDepoisDeLimpar('semente=32&pre=12&auto', 's2-retrato-limpeza.png', 2));
  await c.ir(jogo('semente=33&pre=18&fixo'), 1800);
  shots.push(await salvar('s3-retrato-fixo.png'));
  await c.tamanho(1280, 720, 1.5);
  shots.push(await printDepoisDeLimpar('semente=34&pre=14&auto', 's4-paisagem-limpeza.png', 2));
  await c.tamanho(540, 960, 2);
  await c.ir(jogo('semente=35&pre=26'), 1500);
  await c.avaliar('__jogo.encerrar()');
  await espera(1500);
  shots.push(await salvar('s5-retrato-fim.png'));
  shots.forEach((p, i) => copyFileSync(p, join(DESTINO, `screenshot-0${i + 1}.png`)));
  process.stdout.write('screenshots ok\n');

  // ---------------------------------------------------------------- preview (quadros do proprio jogo)
  await c.tamanho(720, 720, 1);
  await c.ir(jogo('semente=41&pre=10&filme=30&dur=12000&larg=720'), 400);
  let titulo = '';
  for (let k = 0; k < 600 && !titulo.startsWith('filme'); k++) { await espera(250); titulo = String(await c.avaliar('document.title')); }
  const quadros = String(await c.avaliar("document.getElementById('filme').textContent")).split('\n').filter((l) => l.startsWith('data:image'));
  const pq = join(TMP, 'quadros');
  mkdirSync(pq, { recursive: true });
  quadros.forEach((q, i) => writeFileSync(join(pq, `q${String(i).padStart(4, '0')}.jpg`), Buffer.from(q.split(',')[1], 'base64')));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', join(pq, 'q%04d.jpg'), '-t', '12', '-an', '-vf', 'scale=720:720,format=yuv420p',
    '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart', join(DESTINO, 'preview.mp4')]);
  process.stdout.write(`preview ok (${quadros.length} quadros)\n`);

  // ---------------------------------------------------------------- arte: tabuleiro sem HUD
  await c.tamanho(600, 760, 2);
  await c.ir(jogo('semente=51&pre=20&fixo&semhud'), 1800);
  const L = await c.avaliar('__jogo.cena.L');
  const arte = await salvar('arte-retrato.png');
  // recorte do tabuleiro (com a moldura) em px do print (escala 2)
  const pad = L.cs * 0.42;
  const rx = Math.round((L.tab.x - pad) * 2);
  const ry = Math.round((L.tab.y - pad) * 2);
  const rl = Math.round((L.tab.w + pad * 2) * 2);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arte, '-vf', `crop=${rl}:${rl}:${rx}:${ry}`, join(TMP, 'tabuleiro.png')]);
  const fundoCapa = shots[3];

  const fonte = `${BASE}/dist/src/ui/fontes/fredoka-latin-700-normal.woff2`;
  const css = `
    @font-face { font-family: 'Fredoka'; src: url('${fonte}') format('woff2'); font-weight: 700; }
    * { margin: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #05061a; font-family: 'Fredoka', sans-serif; font-weight: 700; color: #fff; }
    .titulo { line-height: 0.95; text-align: center; letter-spacing: 0.01em; }
    .titulo .a { display: block; color: #fff; text-shadow: 0 0 0.12em #7fa8ff, 0 0 0.4em #7f6bffaa, 0 0.06em 0 #2b2470; }
    .titulo .b { display: block; color: #ffd54a; text-shadow: 0 0 0.14em #ffb703, 0 0 0.45em #ff9be688, 0 0.06em 0 #7a4b00; }`;
  const ceu = `radial-gradient(circle at 30% 20%, #4b2a9a55, transparent 45%), radial-gradient(circle at 80% 85%, #1f6f8f55, transparent 50%), linear-gradient(160deg, #070a24, #1a0d3d)`;
  const estrelas = Array.from({ length: 70 }, (_, k) => {
    const x = (k * 137.5) % 100;
    const y = (k * 61.8) % 100;
    const s = 1 + (k % 3);
    return `<i style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;border-radius:50%;background:#fff;opacity:${0.3 + (k % 5) * 0.12}"></i>`;
  }).join('');
  const tab = `${BASE}/.tmp/midias/tabuleiro.png`;

  writeFileSync(join(TMP, 'thumb.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    body { width: 512px; height: 512px; background: ${ceu}; position: relative; }
    .tab { position: absolute; left: 50%; top: 65%; width: 320px; height: 320px; transform: translate(-50%, -50%) rotate(-6deg);
      border-radius: 34px; background: url('${tab}') center/cover; box-shadow: 0 24px 50px #0009, 0 0 40px #7f6bff66; }
    .titulo { position: absolute; left: 0; right: 0; top: 12px; }
    .titulo .a { font-size: 70px; } .titulo .b { font-size: 70px; margin-top: -8px; }
  </style></head><body>${estrelas}<div class="tab"></div><div class="titulo"><span class="a">Magic</span><span class="b">Block</span></div></body></html>`);
  writeFileSync(join(TMP, 'capa.html'), `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    body { width: 1920px; height: 1080px; position: relative; }
    .fundo { position: absolute; inset: -40px; background: url('${BASE}/.tmp/midias/${fundoCapa.split('/').pop()}') center/cover; filter: blur(14px) brightness(0.55) saturate(1.2); }
    .veu { position: absolute; inset: 0; background: linear-gradient(90deg, #070a24f2 0%, #070a24c0 40%, #070a2420 75%, transparent); }
    .tab { position: absolute; right: 150px; top: 50%; width: 780px; height: 780px; transform: translateY(-50%) rotate(-4deg);
      border-radius: 70px; background: url('${tab}') center/cover; box-shadow: 0 40px 90px #000a, 0 0 70px #7f6bff66; }
    .titulo { position: absolute; left: 140px; top: 50%; transform: translateY(-58%); text-align: left; }
    .titulo .a, .titulo .b { font-size: 190px; }
  </style></head><body><div class="fundo"></div><div class="veu"></div>${estrelas}<div class="tab"></div>
    <div class="titulo"><span class="a">Magic</span><span class="b">Block</span></div></body></html>`);

  await c.tamanho(512, 512, 2);
  await c.ir(`${BASE}/.tmp/midias/thumb.html`, 1500);
  writeFileSync(join(DESTINO, 'thumb.png'), await c.print());
  await c.tamanho(1920, 1080, 1);
  await c.ir(`${BASE}/.tmp/midias/capa.html`, 1500);
  writeFileSync(join(DESTINO, 'capa.png'), await c.print());
  process.stdout.write('thumb e capa ok\n');
  if (c.erros.length) process.stdout.write('erros: ' + JSON.stringify(c.erros) + '\n');
} finally {
  await c.fechar();
  await fechar();
}
process.stdout.write(`midias em ${DESTINO}\n`);

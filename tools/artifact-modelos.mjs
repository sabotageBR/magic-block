// Monta o hub dos modelos no formato do Artifact do claude.ai em .tmp/artifact/ (tudo na raiz):
//   index.html        o hub (modelos/index.html sem doctype/html/head/body: o publicador poe o
//                     esqueleto), com os botoes Jogar apontando para jogar-N.html;
//   jogar.html        o prototipo (combinacoes pelo hash), jogar-N.html com o tema N fixo;
//   jogar.js, temas/  com os imports trocados de '../src/' para './src/';
//   src/**, prints (videos, capas, paisagem/desktop, folhas) e medidas.json.
// Imprime o mapa de arquivos (JSON) para o campo `files` do publish.
// Uso: node tools/artifact-modelos.mjs
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAIZ } from './servir.mjs';
import { IDS } from './prints-modelos-ids.mjs';

const pasta = join(RAIZ, '.tmp/artifact');
rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta, { recursive: true });
const ler = (p) => readFileSync(join(RAIZ, p), 'utf8');
const gravar = (p, t) => { mkdirSync(join(pasta, p, '..'), { recursive: true }); writeFileSync(join(pasta, p), t); };

// hub sem o esqueleto
let hub = ler('modelos/index.html')
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/\.\.\/src\//g, './src/')
  .replace('href: `jogar.html#tema=${n}`', 'href: `jogar-${n}.html`');
if (!hub.includes('jogar-${n}.html')) throw new Error('o link Jogar das fichas mudou: ajuste o artifact-modelos.mjs');
gravar('index.html', hub);

// prototipo
const jogarHtml = ler('modelos/jogar.html').replace(/\.\.\/src\//g, './src/');
gravar('jogar.html', jogarHtml);
for (let n = 1; n <= 6; n++) {
  gravar(`jogar-${n}.html`, jogarHtml.replace('<script type="module" src="jogar.js"></script>',
    `<script>window.__magicblockPadrao = 'tema=${n}';</script>\n  <script type="module" src="jogar.js"></script>`));
}
gravar('jogar.js', ler('modelos/jogar.js').replace(/'\.\.\/src\//g, "'./src/"));
for (const f of readdirSync(join(RAIZ, 'modelos/temas'))) {
  gravar(`temas/${f}`, ler(`modelos/temas/${f}`).replace(/'\.\.\/\.\.\/src\//g, "'../src/"));
}
cpSync(join(RAIZ, 'src'), join(pasta, 'src'), { recursive: true });
gravar('medidas.json', ler('modelos/medidas.json'));

// midias que o hub usa
mkdirSync(join(pasta, 'prints'), { recursive: true });
const midias = ['folha-retrato.jpg'];
IDS.forEach((id, k) => {
  const n = k + 1;
  midias.push(`${n}-${id}.mp4`, `${n}-${id}-capa.jpg`, `${n}-${id}-paisagem.jpg`, `${n}-${id}-desktop.jpg`);
});
for (const m of midias) cpSync(join(RAIZ, 'modelos/prints', m), join(pasta, 'prints', m));

// mapa para o publish (tudo menos a pagina principal)
const lista = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? lista(p) : [p];
});
const mapa = {};
let bytes = 0;
for (const p of lista(pasta)) {
  const r = relative(pasta, p);
  bytes += statSync(p).size;
  if (r !== 'index.html') mapa[r] = relative(RAIZ, p);
}
process.stdout.write(JSON.stringify(mapa) + '\n');
process.stderr.write(`${Object.keys(mapa).length + 1} arquivos, ${(bytes / 1048576).toFixed(1)} MB em .tmp/artifact/\n`);

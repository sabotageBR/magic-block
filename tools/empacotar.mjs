// Monta o pacote do jogo para um portal: copia so o jogo (index.html, LICENCAS.txt e src/; as ferramentas,
// os testes e a documentacao ficam fora) para a pasta da build, confere e zipa (index.html na raiz do zip).
// (Copia do tools/empacotar.mjs do tic-tac-toe-deluxe, com o alvo y8 portado do kit multiportal,
// jogos/distribuicao/kit/tools/empacotar.mjs; aqui o slug vem do package.json, porque a pasta do projeto e
// magic_block e fica fora de jogos/.)
//
// Uso: node tools/empacotar.mjs [--alvo=californiagames|y8] [--sem-copia]
// - californiagames (padrao, npm run empacotar): arvore em dist/, zip em
//   dist-californiagames/magic-block-californiagames-<versao>.zip (+ .sha256), copiado para
//   ../jogos/distribuicao/magic-block/californiagames/build/. Leva a camada propria (src/core/plataforma.js)
//   e a tag RELATIVA /sdk/v1/plataforma-sdk.js no <head> (a SDK nunca vai no zip). A pasta src/core/portais/
//   (so da Y8) fica fora.
// - y8 (npm run empacotar:y8): arvore em dist-y8/jogo/, zip em dist-y8/magic-block-y8-<versao>.zip (+ .sha256),
//   copiado para ../jogos/distribuicao/magic-block/y8/build/. O src/core/plataforma.js vira o reexport de
//   portais/y8.js; os ids do Developer Portal da Y8 saem de package.json "kit.ids.y8" (o mesmo lugar dos
//   jogos do kit) e vao no IDS do adaptador; a tag da SDK vira a do CDN da Y8 (async, com onerror: sem o
//   script o jogo segue na hora, sem anuncios). Sem os ids o zip sai "-sem-id" (o SDK nao inicia, so teste).
// - --sem-copia: nao copia o zip para a distribuicao (conferir a build sem trocar o pacote ja publicado).
// Recusa (as regras do ValidadorBuild do californiagames.io, as da documentacao das SDKs e as da Y8): URL
// absoluta (fora a SDK do alvo), console.log, .map, lixo do sistema, extensao proibida, import quebrado,
// marca de outro portal, link para fora e tamanho acima do limite do portal.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { RAIZ } from './servir.mjs';

const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
/** o slug da distribuicao (magic-block) */
const SLUG = pacote.name;
const SDK_CG = '/sdk/v1/plataforma-sdk.js';
const TAG_CG = `<script src="${SDK_CG}"></script>`;
const SDK_Y8 = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const DISTRIBUICAO = join(RAIZ, '..', 'jogos', 'distribuicao');
const PROIBIDAS = new Set(['.sh', '.py', '.php', '.exe', '.jar', '.bat', '.cmd', '.dll', '.so', '.dylib', '.pl', '.rb', '.cgi', '.map']);
const MB = 1024 * 1024;

/**
 * @typedef {Object} Alvo
 * @property {string} arvore   pasta da build (copia do jogo)
 * @property {string} saida    pasta do zip e do .sha256
 * @property {string} pasta    pasta do portal na distribuicao
 * @property {string} sdk      endereco da SDK (a unica URL externa permitida)
 * @property {string} tag      a tag da SDK no <head>
 * @property {string} [adaptador]  portais/<adaptador>.js no lugar da camada do californiagames.io
 * @property {string[]} [ids]  ids do painel do portal (package.json "kit.ids.<alvo>")
 * @property {RegExp} proibido marca de outro portal (fora dos comentarios)
 * @property {RegExp} [proibidoSempre] nem nos comentarios
 * @property {number} maxMb
 * @property {number} maxArquivos
 */

/** @type {Record<string, Alvo>} */
export const ALVOS = {
  californiagames: {
    arvore: join(RAIZ, 'dist'), saida: join(RAIZ, 'dist-californiagames'), pasta: 'californiagames',
    sdk: SDK_CG, tag: TAG_CG,
    proibido: /poki|crazygames/i, maxMb: 8, maxArquivos: 5000,
  },
  // Y8: SDK 2-0 async do CDN deles; se o script nao carregar (bloqueador de anuncio), o onerror avisa e o
  // adaptador segue na hora, sem esperar o prazo do init (o mesmo tagDe/eventoFalha do kit)
  y8: {
    arvore: join(RAIZ, 'dist-y8', 'jogo'), saida: join(RAIZ, 'dist-y8'), pasta: 'y8',
    sdk: SDK_Y8,
    tag: `<script src="${SDK_Y8}" async onerror="window.__sdkFalhou=1;window.dispatchEvent(new Event('y8sdk.falhou'))"></script>`,
    adaptador: 'y8', ids: ['appId', 'gameId'],
    proibido: /poki|crazygames|californiagames|plataforma-sdk|PlataformaSDK/i, proibidoSempre: /plataforma-sdk|PlataformaSDK|\/sdk\/v1\//,
    maxMb: 50, maxArquivos: 1500,
  },
};

/** @param {string} d @returns {string[]} */
const listar = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});
/** @param {string} t */
const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/**
 * Monta e confere a arvore da build de um alvo (sem zipar).
 * @param {string} nomeAlvo
 * @param {{ arvore?: string }} [o]  arvore: outra pasta de saida (testes)
 * @returns {{ arvore: string, falhas: string[], avisos: string[], arquivos: string[], bruto: number, gz: number, semId: boolean }}
 */
export function montar(nomeAlvo, { arvore } = {}) {
  const A = ALVOS[nomeAlvo];
  if (!A) throw new Error(`alvo desconhecido: ${nomeAlvo} (${Object.keys(ALVOS).join(', ')})`);
  const dist = arvore || A.arvore;
  const falhas = [];
  const avisos = [];

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  for (const item of ['index.html', 'LICENCAS.txt', 'src']) cpSync(join(RAIZ, item), join(dist, item), { recursive: true });
  // lixo do sistema nunca vai (o portal recusa .DS_Store e __MACOSX)
  for (const f of listar(dist)) if (/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(f)) rmSync(f);

  // 1) a camada do portal: o californiagames.io usa src/core/plataforma.js como esta e nao leva portais/;
  //    os outros trocam a camada pelo reexport do adaptador e levam so ele e a fila
  const pastaPortais = join(dist, 'src/core/portais');
  let semId = false;
  if (!A.adaptador) rmSync(pastaPortais, { recursive: true, force: true });
  else {
    const fica = new Set([`${A.adaptador}.js`, 'fila-sdk.js']);
    if (!existsSync(join(pastaPortais, `${A.adaptador}.js`))) falhas.push(`falta src/core/portais/${A.adaptador}.js`);
    else {
      for (const f of readdirSync(pastaPortais)) if (!fica.has(f)) rmSync(join(pastaPortais, f), { recursive: true, force: true });
      writeFileSync(join(dist, 'src/core/plataforma.js'),
        `// Build ${nomeAlvo} (tools/empacotar.mjs --alvo=${nomeAlvo}): a camada do portal e o adaptador portais/${A.adaptador}.js.\n`
        + `export { portal } from './portais/${A.adaptador}.js';\n`);
    }
    // ids do painel do portal: package.json "kit.ids.<alvo>"
    if (A.ids && existsSync(join(pastaPortais, `${A.adaptador}.js`))) {
      const ids = (pacote.kit && pacote.kit.ids && pacote.kit.ids[nomeAlvo]) || {};
      const arq = join(pastaPortais, `${A.adaptador}.js`);
      const t = readFileSync(arq, 'utf8');
      const vazio = 'export const IDS = {};';
      const preenchidos = Object.fromEntries(A.ids.filter((k) => ids[k]).map((k) => [k, String(ids[k])]));
      semId = A.ids.some((k) => !ids[k]);
      if (t.split(vazio).length !== 2) falhas.push(`${A.adaptador}.js sem "${vazio}" (uma vez) para gravar os ids`);
      else writeFileSync(arq, t.replace(vazio, `export const IDS = ${JSON.stringify(preenchidos)};`));
      if (semId) avisos.push(`SEM ${A.ids.filter((k) => !ids[k]).join(' e ')} (package.json "kit.ids.${nomeAlvo}"): zip so para teste, o SDK nao inicia`);
    }
  }

  // 2) a tag da SDK (o index.html do projeto leva a do californiagames.io)
  const htmlArq = join(dist, 'index.html');
  let html = readFileSync(htmlArq, 'utf8');
  if (A.tag !== TAG_CG) {
    if (html.split(TAG_CG).length !== 2) falhas.push(`index.html sem a tag ${TAG_CG} (uma vez) para trocar`);
    else {
      html = html.replace(TAG_CG, A.tag);
      // o comentario que explica a SDK do californiagames.io sai junto
      html = html.replace(/<!--[\s\S]*?-->\n?/g, (c) => (/californiagames|PlataformaSDK|plataforma-sdk/i.test(c)
        ? `<!-- ${nomeAlvo}: a SDK do portal, async; sem ela o jogo segue sem anuncios. -->\n` : c));
      writeFileSync(htmlArq, html);
    }
  }

  // 3) conferencias
  const arquivos = listar(dist);
  if (!/viewport-fit=cover/.test(html)) falhas.push('index.html sem viewport-fit=cover');
  // a SDK no <head>, antes dos scripts do jogo
  const cabeca = html.split('</head>')[0];
  if (!cabeca.includes(A.tag)) falhas.push('a tag da SDK deve ficar no <head>');
  const iModulo = cabeca.search(/<script[^>]*type="module"/);
  if (iModulo >= 0 && cabeca.indexOf(A.sdk) > iModulo) falhas.push('a SDK deve vir antes dos scripts do jogo');
  if (arquivos.length > A.maxArquivos) falhas.push(`${arquivos.length} arquivos (limite ${A.maxArquivos})`);
  let bruto = 0;
  let gz = 0;
  for (const p of arquivos) {
    const r = relative(dist, p);
    const dados = readFileSync(p);
    bruto += dados.length;
    gz += gzipSync(dados, { level: 9 }).length;
    if (PROIBIDAS.has(extname(p).toLowerCase())) falhas.push(`extensao proibida: ${r}`);
    if (/plataforma-sdk|y8\.min\.js/.test(r)) falhas.push('a SDK nao vai dentro do build');
    if (!/\.(html|js|css)$/.test(p)) continue;
    const t = dados.toString('utf8');
    const s = semComentarios(t);
    for (const u of t.match(/https?:\/\/[^\s"'`)<>]+/g) || []) if (u !== A.sdk) falhas.push(`URL absoluta em ${r}: ${u}`);
    if (/console\.(log|info|debug)\s*\(/.test(t)) falhas.push(`console.log em ${r}`);
    const marca = s.replace(A.sdk, '').match(A.proibido);
    if (marca) falhas.push(`marca de outro portal em ${r}: ${marca[0]}`);
    const sempre = A.proibidoSempre && t.replace(A.sdk, '').match(A.proibidoSempre);
    if (sempre) falhas.push(`SDK de outro portal citada em ${r}: ${sempre[0]}`);
    // nenhum link nem redirecionamento para fora do jogo (regra da Y8)
    if (/<a\s[^>]*href|window\.open\s*\(|location\.(href\s*=|assign\s*\(|replace\s*\()/.test(s)) falhas.push(`link ou redirecionamento em ${r}`);
    if (p.endsWith('.js')) {
      // sem os comentarios: os tipos do JSDoc citam modulos fora do build
      for (const m of s.matchAll(/(?:import|export)\s*(?:[^'"]*from\s*)?\(?\s*'(\.[^']+)'/g)) {
        if (!existsSync(join(p, '..', m[1]))) falhas.push(`import quebrado em ${r}: ${m[1]}`);
      }
    }
  }
  if (bruto > A.maxMb * MB) falhas.push(`build acima de ${A.maxMb} MB (${(bruto / MB).toFixed(1)} MB)`);
  return { arvore: dist, falhas, avisos, arquivos, bruto, gz, semId };
}

/**
 * Monta, confere, zipa e (sem semCopia) copia para a distribuicao.
 * @param {string} nomeAlvo
 * @param {{ semCopia?: boolean }} [o]
 */
function empacotar(nomeAlvo, { semCopia = false } = {}) {
  const A = ALVOS[nomeAlvo];
  const m = montar(nomeAlvo);
  for (const a of m.avisos) process.stdout.write(`aviso: ${a}\n`);
  if (m.falhas.length) {
    process.stdout.write('FALHOU:\n  ' + m.falhas.join('\n  ') + '\n');
    return false;
  }
  const nome = `${SLUG}-${nomeAlvo}-${pacote.version}${m.semId ? '-sem-id' : ''}`;
  const zip = join(A.saida, `${nome}.zip`);
  mkdirSync(A.saida, { recursive: true });
  rmSync(zip, { force: true });
  const z = spawnSync('zip', ['-qr', '-X', zip, '.'], { cwd: m.arvore, encoding: 'utf8' });
  if (z.status !== 0) {
    process.stdout.write('zip falhou: ' + z.stderr + '\n');
    return false;
  }
  const teste = spawnSync('unzip', ['-tq', zip], { encoding: 'utf8' });
  const lista = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.trim().split('\n');
  if (teste.status !== 0 || !lista.includes('index.html') || lista.some((n) => /__MACOSX|\.DS_Store/.test(n))) {
    process.stdout.write('zip invalido, sem index.html na raiz ou com lixo do sistema\n');
    return false;
  }
  const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
  writeFileSync(join(A.saida, `${nome}.sha256`), `${sha}  ${nome}.zip\n`);
  if (!semCopia && existsSync(DISTRIBUICAO)) {
    const copia = join(DISTRIBUICAO, SLUG, A.pasta, 'build');
    mkdirSync(copia, { recursive: true });
    cpSync(zip, join(copia, `${nome}.zip`));
    cpSync(join(A.saida, `${nome}.sha256`), join(copia, `${nome}.sha256`));
    process.stdout.write(`copiado para ${copia}\n`);
  }
  process.stdout.write(`build ok: ${m.arquivos.length} arquivos, ${(m.bruto / 1024).toFixed(0)} KB (${(m.gz / 1024).toFixed(0)} KB gzip)\n`);
  process.stdout.write(`${relative(RAIZ, zip)}: ${(statSync(zip).size / 1024).toFixed(0)} KB, sha256 ${sha}\n`);
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const alvo = (process.argv.find((a) => a.startsWith('--alvo=')) || '--alvo=californiagames').slice(7);
  if (!ALVOS[alvo]) {
    process.stdout.write(`alvo desconhecido: ${alvo} (${Object.keys(ALVOS).join(', ')})\n`);
    process.exit(1);
  }
  process.exit(empacotar(alvo, { semCopia: process.argv.includes('--sem-copia') }) ? 0 : 1);
}

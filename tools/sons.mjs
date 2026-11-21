// Renderiza cada som do jogo offline no Chrome (OfflineAudioContext, o mesmo grafo seco do jogo, sem o
// reverb) e mede pico, RMS e NaN; grava os WAV em .tmp/sons/ para ouvir.
// Uso: node tools/sons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servir.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTA = join(RAIZ, '.tmp/sons');
mkdirSync(PASTA, { recursive: true });
const CASOS = [
  ['pegar', {}], ['girar', { giro: 1 }], ['colocar', { n: 3 }], ['recusa', {}], ['bandeja', {}],
  ['limpar', { k: 1, seq: 1 }], ['limpar', { k: 2, seq: 1 }], ['limpar', { k: 3, seq: 1 }], ['limpar', { k: 4, seq: 5, dobro: true }],
  ['combo', { seq: 2 }], ['combo', { seq: 6 }], ['combo', { seq: 9 }], ['perfeito', {}],
  ['aviso', {}], ['estrela', {}], ['coletou', {}], ['fim', {}], ['recorde', {}], ['reviver', {}], ['botao', {}],
];

const fechar = await servir(5423);
const c = await abrirChrome({ largura: 800, altura: 600, porta: 9396 });
let ruins = 0;
try {
  await c.ir('http://127.0.0.1:5423/modelos/sons.html', 1500);
  for (const [nome, p] of CASOS) {
    const r = await c.avaliar(`medirSom(${JSON.stringify(nome)}, ${JSON.stringify(p)}, 3.5)`);
    const rotulo = nome + (Object.keys(p).length ? '-' + Object.values(p).join('-') : '');
    writeFileSync(join(PASTA, rotulo + '.wav'), Buffer.from(r.wav, 'base64'));
    const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
    const ruim = r.nan > 0 || r.pico < 0.01 || r.pico > 0.99;
    if (ruim) ruins++;
    console.log(`${ruim ? '✘' : '✔'} ${rotulo.padEnd(18)} dur ${r.dur.toFixed(2)} s  pico ${db(r.pico)} dB  rms ${db(r.rms)} dB${r.nan ? '  NaN ' + r.nan : ''}`);
  }
  if (c.erros.length) { console.error(c.erros); ruins++; }
} finally {
  await c.fechar();
  await fechar();
}
console.log(ruins ? `${ruins} com problema` : `ok: WAVs em ${PASTA}`);
process.exit(ruins ? 1 : 0);

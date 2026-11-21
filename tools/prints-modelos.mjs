// Prints dos modelos (cena parada: tabuleiro jogado e uma peca no ar com a previa acesa) em retrato,
// paisagem e desktop, mais as folhas de comparacao. Chrome headless pelo CDP (viewport emulado).
// Uso: node tools/prints-modelos.mjs [tema ...]   (sem argumentos: os 6)
//   saida: modelos/prints/<n>-<tema>-<retrato|paisagem|desktop>.jpg e folha-<rot>.jpg
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { abrirChrome } from './cdp.mjs';
import { servir } from './servir.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTA = join(RAIZ, 'modelos/prints');
const TMP = join(RAIZ, '.tmp/prints');
import { IDS } from './prints-modelos-ids.mjs';
export const SEMENTES = [5, 5, 5, 5, 5, 5];
const TAMANHOS = { retrato: [390, 844], paisagem: [844, 390], desktop: [1280, 720] };
const PORTA = 5421;

const temas = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 6);
const lista = temas.length ? temas : [1, 2, 3, 4, 5, 6];
mkdirSync(PASTA, { recursive: true });
mkdirSync(TMP, { recursive: true });

const fechar = await servir(PORTA);
const c = await abrirChrome({ largura: 390, altura: 844, escala: 2, porta: 9381 });
let falhas = 0;
try {
  for (const n of lista) {
    for (const [rot, [w, h]] of Object.entries(TAMANHOS)) {
      await c.tamanho(w, h, rot === 'desktop' ? 1.5 : 2);
      await c.ir(`http://127.0.0.1:${PORTA}/modelos/jogar.html?p=${n}${rot}#tema=${n}&fixo&semente=${SEMENTES[n - 1]}`, 1600);
      const png = join(TMP, `${n}-${rot}.png`);
      writeFileSync(png, await c.print());
      const jpg = join(PASTA, `${n}-${IDS[n - 1]}-${rot}.jpg`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', jpg]);
      if (c.erros.length) { falhas++; console.error(n, rot, c.erros.splice(0)); }
    }
    process.stdout.write(`${n}-${IDS[n - 1]} `);
  }
} finally {
  await c.fechar();
  await fechar();
}

// folhas de comparacao com os 6 lado a lado
for (const [rot, larg, cols] of [['retrato', 300, 6], ['paisagem', 560, 3], ['desktop', 560, 3]]) {
  const arqs = [1, 2, 3, 4, 5, 6].map((n) => join(PASTA, `${n}-${IDS[n - 1]}-${rot}.jpg`)).filter((f) => existsSync(f));
  if (arqs.length < 2) continue;
  const ent = arqs.flatMap((f) => ['-i', f]);
  const esc = arqs.map((_, k) => `[${k}]scale=${larg}:-2[v${k}]`).join(';');
  const pos = arqs.map((_, k) => {
    const col = k % cols;
    const lin = Math.floor(k / cols);
    const x = col ? Array.from({ length: col }, (_, j) => `w${j}`).join('+') : '0';
    const y = lin ? Array.from({ length: lin }, (_, j) => `h${j * cols}`).join('+') : '0';
    return `${x}_${y}`;
  }).join('|');
  const filtro = `${esc};${arqs.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${arqs.length}:layout=${pos}:fill=black`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ent, '-filter_complex', filtro, '-q:v', '3', join(PASTA, `folha-${rot}.jpg`)]);
}
console.log(falhas ? `\n${falhas} com erro` : '\nok');
process.exit(falhas ? 1 : 0);

// GIF e MP4 de cada modelo: a pagina simula o bot jogando sem relogio real (&filme) e devolve os
// quadros; o ffmpeg monta o GIF com paleta e o MP4 (H.264, sem som) que o hub usa.
// Uso: node tools/gif-modelos.mjs [tema ...] [--dur=9000]
//   saida: modelos/prints/<n>-<tema>.gif, .mp4 e -capa.jpg (primeiro quadro)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { abrirChrome, espera } from './cdp.mjs';
import { servir } from './servir.mjs';
import { IDS } from './prints-modelos-ids.mjs';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PASTA = join(RAIZ, 'modelos/prints');
const PORTA = 5422;
const FPS = 12;
const args = process.argv.slice(2);
const DUR = Number((args.find((a) => a.startsWith('--dur=')) || '--dur=9000').slice(6));
const temas = args.map(Number).filter((n) => n >= 1 && n <= 6);
const lista = temas.length ? temas : [1, 2, 3, 4, 5, 6];
/** extras por tema para a mecanica aparecer nos 9 s */
const EXTRAS = { 1: '&mana=0.8', 2: '', 3: '', 4: '&pre=12', 5: '', 6: '' };

mkdirSync(PASTA, { recursive: true });
const fechar = await servir(PORTA);
const c = await abrirChrome({ largura: 390, altura: 844, escala: 1, porta: 9382 });
try {
  for (const n of lista) {
    const url = `http://127.0.0.1:${PORTA}/modelos/jogar.html?g=${n}#tema=${n}&filme=${FPS}&dur=${DUR}&larg=320&pre=8&semente=${20 + n}${EXTRAS[n]}`;
    await c.ir(url, 400);
    let titulo = '';
    for (let k = 0; k < 400 && !titulo.startsWith('filme'); k++) {
      await espera(250);
      titulo = String(await c.avaliar('document.title'));
      if (titulo.startsWith('ERRO')) throw new Error(titulo);
    }
    const texto = String(await c.avaliar("document.getElementById('filme').textContent"));
    const quadros = texto.split('\n').filter((l) => l.startsWith('data:image'));
    const tmp = join(RAIZ, '.tmp/gif-' + n);
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    quadros.forEach((q, i) => writeFileSync(join(tmp, `q${String(i).padStart(4, '0')}.jpg`), Buffer.from(q.split(',')[1], 'base64')));
    const base = join(PASTA, `${n}-${IDS[n - 1]}`);
    const ent = ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(tmp, 'q%04d.jpg')];
    execFileSync('ffmpeg', [...ent, '-vf', 'scale=240:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', base + '.gif']);
    execFileSync('ffmpeg', [...ent, '-vf', 'scale=320:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow', '-movflags', '+faststart', '-an', base + '.mp4']);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(tmp, 'q0000.jpg'), '-q:v', '3', base + '-capa.jpg']);
    console.log(`${n}-${IDS[n - 1]}: ${quadros.length} quadros`, c.erros.splice(0));
  }
} finally {
  await c.fechar();
  await fechar();
}

// Mede cada mecanica com o bot direto no nucleo, sem navegador, em dois niveis:
//   bom   - ruido 0, joga o melhor que sabe;
//   medio - ruido no julgamento, erra como uma pessoa distraida.
// Uso: node tools/medir-modelos.mjs [partidas=100] [--json]
//   --json grava modelos/medidas.json (o hub mostra os numeros nas fichas).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { criarPartida } from '../src/jogo/partida.js';
import { escolherJogada, aplicarJogada } from '../src/jogo/bot.js';
import { MECANICAS } from '../src/jogo/regras.js';
import { criarRng } from '../src/core/rng.js';

export const NIVEIS = { bom: 0, medio: 40 };
/** Segundos por jogada de uma pessoa (arrastar, olhar, soltar), para estimar a duracao. */
const SEG_JOGADA = 3.2;
const LIMITE = 5000;
/** Contador do que cada mecanica tem de proprio. */
const EXTRA = { mana: 'feiticos', sabores: 'puras', bombas: 'explosoes', estrelas: 'coletadas', galaxia: 'coletadas' };

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const N = Number(args[0]) || 100;

const med = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const mediana = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

/** @param {number} mec @param {number} ruido */
function medir(mec, ruido) {
  const jog = [];
  const pts = [];
  const taxa = [];
  const seqs = [];
  const extra = [];
  const desarmadas = [];
  let presas = 0;
  const campo = EXTRA[MECANICAS[mec].id];
  for (let s = 1; s <= N; s++) {
    const E = criarPartida({ mec, semente: s * 7919 + mec });
    const rng = criarRng(s * 104729 + mec);
    let k = 0;
    while (!E.fim && k < LIMITE) {
      const j = escolherJogada(E, { rng, ruido });
      if (!j || !aplicarJogada(E, j)) break;
      k++;
    }
    if (!E.fim) presas++;
    jog.push(E.jogadas);
    pts.push(E.pontos);
    taxa.push(E.jogadas ? E.limpezas / E.jogadas : 0);
    seqs.push(E.melhorSeq);
    extra.push(campo ? E[campo] : 0);
    desarmadas.push(E.desarmadas);
  }
  return {
    mec, id: MECANICAS[mec].id,
    jogadas: Math.round(med(jog)), jogadasMediana: mediana(jog),
    pontos: Math.round(med(pts)), pontosMediana: mediana(pts),
    limpaPct: Math.round(med(taxa) * 100), melhorSeq: Math.round(med(seqs) * 10) / 10,
    extra: Math.round(med(extra) * 10) / 10, extraNome: campo || '',
    desarmadas: Math.round(med(desarmadas) * 10) / 10,
    minutos: Math.round((med(jog) * SEG_JOGADA) / 6) / 10,
    presas,
  };
}

const saida = { bom: {}, medio: {} };
for (const [nivel, ruido] of Object.entries(NIVEIS)) {
  process.stdout.write(`-- ${nivel} (ruido ${ruido})\n`);
  for (let mec = 0; mec < MECANICAS.length; mec++) {
    const r = medir(mec, ruido);
    saida[nivel][r.id] = r;
    process.stdout.write(`${mec} ${r.id.padEnd(11)} jogadas ${String(r.jogadas).padStart(5)} (med ${r.jogadasMediana})  pontos ${String(r.pontos).padStart(6)}  limpa ${r.limpaPct}%  seq ${r.melhorSeq}  ${r.extraNome} ${r.extra}  ~${r.minutos} min${r.presas ? '  no limite: ' + r.presas : ''}\n`);
  }
}
if (process.argv.includes('--json')) {
  writeFileSync(join(RAIZ, 'modelos/medidas.json'), JSON.stringify({ partidas: N, niveis: NIVEIS, segJogada: SEG_JOGADA, limite: LIMITE, ...saida }, null, 2) + '\n');
  process.stdout.write('modelos/medidas.json\n');
}

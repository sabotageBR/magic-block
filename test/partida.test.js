// Nucleo comum: colocar, limpar linha e coluna, pontos, sequencia, fim de jogo, anti-frustracao e
// determinismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPartida, colocar, semJogada } from '../src/jogo/partida.js';
import { sortearBandeja, pecaCabe } from '../src/jogo/sorteio.js';
import { FORMAS, ORIENTACOES, girar90, limites } from '../src/jogo/formas.js';
import { escolherJogada, aplicarJogada } from '../src/jogo/bot.js';
import { criarRng } from '../src/core/rng.js';

/** Peca de teste no slot. */
function por(E, slot, cels, cor = 1) {
  E.bandeja[slot] = { id: 900 + slot, forma: 'teste', cels, cor, bomba: -1, contador: 0 };
}
/** Preenche casas (x, y) com a cor. */
function encher(E, casas, cor = 2) {
  for (const [x, y] of casas) E.t.cor[y * E.n + x] = cor;
}
const MONO = [[0, 0]];

test('as formas tem orientacoes distintas e cabem no 8x8', () => {
  for (const f of FORMAS) {
    const ors = ORIENTACOES[f.id];
    assert.ok(ors.length >= 1, f.id);
    for (const o of ors) {
      const { w, h } = limites(o);
      assert.ok(w <= 5 && h <= 5, f.id);
    }
  }
  assert.equal(ORIENTACOES.mono.length, 1);
  assert.equal(ORIENTACOES.o9.length, 1);
  assert.equal(ORIENTACOES.l4.length, 8);
  assert.deepEqual(girar90([[0, 0], [1, 0]]), [[0, 0], [0, 1]]);
});

test('colocar ocupa as casas e da 1 ponto por casa', () => {
  const E = criarPartida({ semente: 3 });
  por(E, 0, [[0, 0], [1, 0], [0, 1]], 4);
  const ev = colocar(E, 0, 2, 3);
  assert.ok(ev);
  assert.equal(E.t.cor[3 * 8 + 2], 4);
  assert.equal(E.t.cor[3 * 8 + 3], 4);
  assert.equal(E.t.cor[4 * 8 + 2], 4);
  assert.equal(E.pontos, 3);
  assert.equal(E.bandeja[0], null);
  assert.equal(ev[0].tipo, 'colocou');
});

test('jogada invalida (fora ou em cima de bloco) nao muda nada', () => {
  const E = criarPartida({ semente: 3 });
  por(E, 0, [[0, 0], [1, 0]]);
  assert.equal(colocar(E, 0, 7, 0), null);
  encher(E, [[3, 3]]);
  assert.equal(colocar(E, 0, 2, 3), null);
  assert.equal(E.jogadas, 0);
});

test('linha e coluna ao mesmo tempo: 2 unidades valem 10 x 2 x 2', () => {
  const E = criarPartida({ semente: 5 });
  for (let x = 0; x < 7; x++) encher(E, [[x, 0]]);
  for (let y = 1; y < 8; y++) encher(E, [[7, y]]);
  encher(E, [[2, 5]]); // um bloco que fica (sem o bonus de tabuleiro limpo)
  por(E, 0, MONO);
  const ev = colocar(E, 0, 7, 0);
  const l = ev.find((e) => e.tipo === 'limpou');
  assert.equal(l.k, 2);
  assert.equal(l.pontos, 40);
  assert.equal(E.pontos, 41);
  assert.equal(l.cels.length, 15);
  for (let i = 0; i < 64; i++) assert.equal(E.t.cor[i], i === 5 * 8 + 2 ? 2 : 0);
});

test('sequencia: limpar em jogadas seguidas multiplica; 3 jogadas sem limpar quebram', () => {
  const E = criarPartida({ semente: 7 });
  const linha = (y) => { for (let x = 0; x < 7; x++) encher(E, [[x, y]]); };
  linha(0);
  por(E, 0, MONO);
  colocar(E, 0, 7, 0);
  assert.equal(E.seq, 1);
  linha(1);
  por(E, 1, MONO);
  const ev = colocar(E, 1, 7, 1);
  assert.equal(E.seq, 2);
  assert.equal(ev.find((e) => e.tipo === 'limpou').pontos, 20);
  assert.ok(ev.some((e) => e.tipo === 'sequencia' && e.seq === 2));
  for (let k = 0; k < 3; k++) {
    por(E, 2, MONO);
    colocar(E, 2, k, 5);
  }
  assert.equal(E.seq, 0);
});

test('fim de jogo quando nenhuma peca cabe', () => {
  const E = criarPartida({ semente: 9 });
  // xadrez: so cabe monomino
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) encher(E, [[x, y]]);
  E.bandeja = [null, null, null];
  por(E, 0, [[0, 0], [1, 0]]);
  por(E, 1, MONO);
  assert.equal(semJogada(E), false);
  const ev = colocar(E, 1, 0, 0);
  assert.ok(ev.some((e) => e.tipo === 'fim'));
  assert.equal(E.fim, true);
  assert.equal(colocar(E, 0, 0, 2), null);
});

test('anti-frustracao: com so uma casa livre, a bandeja nova traz uma peca que cabe', () => {
  for (let s = 1; s <= 30; s++) {
    const E = criarPartida({ semente: s });
    for (let i = 0; i < 64; i++) E.t.cor[i] = 2;
    E.t.cor[27] = 0;
    sortearBandeja(E);
    assert.ok(E.bandeja.some((p) => p && pecaCabe(E.t, p.cels)), 'semente ' + s);
  }
});

test('mesma semente, mesma partida (bot sem ruido e com ruido)', () => {
  const jogar = (semente, ruido) => {
    const E = criarPartida({ mec: 0, semente });
    const rng = criarRng(semente * 31);
    const pontos = [];
    for (let k = 0; k < 120 && !E.fim; k++) {
      const j = escolherJogada(E, { rng, ruido });
      if (!j) break;
      colocar(E, j.slot, j.gx, j.gy);
      pontos.push(E.pontos);
    }
    return pontos.join(',');
  };
  assert.equal(jogar(11, 0), jogar(11, 0));
  assert.equal(jogar(11, 80), jogar(11, 80));
  assert.notEqual(jogar(11, 0), jogar(12, 0));
});

test('o bot so propoe jogadas validas e toda partida termina, em todas as mecanicas', () => {
  for (let mec = 0; mec <= 6; mec++) {
    const E = criarPartida({ mec, semente: 100 + mec });
    const rng = criarRng(mec + 1);
    let k = 0;
    while (!E.fim && k < 4000) {
      const j = escolherJogada(E, { rng, ruido: 400 });
      assert.ok(j, 'mec ' + mec);
      assert.ok(aplicarJogada(E, j), 'jogada invalida, mec ' + mec);
      k++;
    }
    assert.ok(E.fim, 'mec ' + mec + ' nao terminou em ' + k);
  }
});

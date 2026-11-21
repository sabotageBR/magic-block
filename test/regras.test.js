// As 6 mecanicas extras dos modelos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPartida, colocar, usarFeitico, girar, semJogada } from '../src/jogo/partida.js';
import { sortearBandeja } from '../src/jogo/sorteio.js';
import { BOMBA_CADA, BOMBA_CONTADOR, ESTRELA_CADA, MECANICAS } from '../src/jogo/regras.js';
import { ENTULHO } from '../src/jogo/tabuleiro.js';

const MONO = [[0, 0]];
function por(E, slot, cels, cor = 1, bomba = -1, contador = 0) {
  E.bandeja[slot] = { id: 900 + slot, forma: 'teste', cels, cor, bomba, contador };
}
function encher(E, casas, cor = 2) {
  for (const [x, y] of casas) E.t.cor[y * E.n + x] = cor;
}
/** Joga um mono numa casa vazia longe de tudo (para passar a vez). */
function passar(E, x, y) {
  por(E, 2, MONO, 5);
  return colocar(E, 2, x, y);
}

test('as mecanicas tem o tabuleiro certo', () => {
  assert.equal(MECANICAS.length, 8);
  assert.equal(criarPartida({ mec: 2 }).n, 9);
  for (const m of [0, 1, 3, 4, 5, 6, 7]) assert.equal(criarPartida({ mec: m }).n, 8);
});

test('mana: limpar enche o orbe; cheio, vira Feitico que limpa linha e coluna', () => {
  const E = criarPartida({ mec: 1, semente: 2 });
  E.mana = 0.8;
  for (let x = 0; x < 7; x++) encher(E, [[x, 0]]);
  por(E, 0, MONO);
  const ev = colocar(E, 0, 7, 0);
  assert.ok(ev.some((e) => e.tipo === 'feitico'));
  assert.equal(E.feitico, true);
  assert.equal(E.mana, 0);
  // o Feitico na casa (3, 4) tira a linha 4 e a coluna 3, ate entulho
  encher(E, [[0, 4], [1, 4], [6, 4], [3, 1], [3, 7]]);
  E.t.cor[4 * 8 + 5] = ENTULHO;
  encher(E, [[6, 6]]);
  const pontosAntes = E.pontos;
  const m = usarFeitico(E, 3, 4);
  assert.ok(m);
  const magia = m.find((e) => e.tipo === 'magia');
  assert.equal(magia.cels.length, 6);
  assert.equal(E.pontos - pontosAntes, 30);
  assert.equal(E.t.cor[6 * 8 + 6], 2);
  assert.equal(E.feitico, false);
  assert.equal(usarFeitico(E, 0, 0), null);
});

test('mana: com Feitico na mao nao ha fim de jogo', () => {
  const E = criarPartida({ mec: 1, semente: 4 });
  for (let i = 0; i < 64; i++) E.t.cor[i] = 2;
  E.feitico = true;
  assert.equal(semJogada(E), false);
});

test('quadrantes: 9x9, quadrante 3x3 cheio limpa junto com linhas', () => {
  const E = criarPartida({ mec: 2, semente: 3 });
  for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) if (!(x === 4 && y === 4)) encher(E, [[x, y]]);
  por(E, 0, MONO);
  const ev = colocar(E, 0, 4, 4);
  const l = ev.find((e) => e.tipo === 'limpou');
  assert.equal(l.k, 1);
  assert.equal(l.grupos[0].tipo, 'quadrante');
  assert.equal(l.grupos[0].k, 4);
  assert.equal(l.cels.length, 9);
  // sem quadrantes (classico 8x8), o mesmo desenho nao limpa nada
  const C = criarPartida({ mec: 0, semente: 3 });
  for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) if (!(x === 4 && y === 4)) encher(C, [[x, y]]);
  por(C, 0, MONO);
  assert.ok(!colocar(C, 0, 4, 4).some((e) => e.tipo === 'limpou'));
});

test('sabores: linha toda de um sabor vale x3; misturada vale normal', () => {
  const E = criarPartida({ mec: 3, semente: 5 });
  for (let x = 0; x < 7; x++) encher(E, [[x, 0]], 3);
  por(E, 0, MONO, 3);
  const pura = colocar(E, 0, 7, 0).find((e) => e.tipo === 'limpou');
  assert.equal(pura.puras, 1);
  assert.equal(pura.pontos, 30);
  const F = criarPartida({ mec: 3, semente: 5 });
  for (let x = 0; x < 7; x++) encher(F, [[x, 0]], 3);
  por(F, 0, MONO, 2);
  const mista = colocar(F, 0, 7, 0).find((e) => e.tipo === 'limpou');
  assert.equal(mista.puras, 0);
  assert.equal(mista.pontos, 10);
  // fora da mecanica sabores, cor igual nao da bonus
  const G = criarPartida({ mec: 0, semente: 5 });
  for (let x = 0; x < 7; x++) encher(G, [[x, 0]], 3);
  por(G, 0, MONO, 3);
  assert.equal(colocar(G, 0, 7, 0).find((e) => e.tipo === 'limpou').pontos, 10);
});

test('bombas: a cada 8 pecas uma traz bomba com contador 7', () => {
  const E = criarPartida({ mec: 4, semente: 8 });
  let com = 0;
  let total = 0;
  for (let k = 0; k < 8; k++) {
    for (const p of E.bandeja) {
      total++;
      if (p.bomba >= 0) { com++; assert.equal(p.contador, BOMBA_CONTADOR); }
    }
    sortearBandeja(E);
  }
  assert.equal(com, Math.floor(total / BOMBA_CADA));
});

test('bombas: o contador baixa a cada jogada; zerou, vira entulho 3x3', () => {
  const E = criarPartida({ mec: 4, semente: 9 });
  por(E, 0, MONO, 1, 0, 2);
  colocar(E, 0, 4, 4);
  const i = 4 * 8 + 4;
  assert.equal(E.t.bomba[i], 2);
  passar(E, 0, 7);
  assert.equal(E.t.bomba[i], 1);
  const ev = passar(E, 7, 7);
  assert.ok(ev.some((e) => e.tipo === 'explodiu' && e.i === i));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(E.t.cor[(4 + dy) * 8 + 4 + dx], ENTULHO);
  assert.equal(E.t.bomba[i], 0);
  assert.equal(E.explosoes, 1);
});

test('bombas: limpar a linha da bomba desarma', () => {
  const E = criarPartida({ mec: 4, semente: 10 });
  for (let x = 0; x < 6; x++) encher(E, [[x, 2]]);
  por(E, 0, MONO, 1, 0, 3);
  colocar(E, 0, 6, 2);
  passar(E, 0, 7);
  por(E, 1, MONO);
  colocar(E, 1, 7, 2);
  assert.equal(E.t.bomba[2 * 8 + 6], 0);
  assert.equal(E.desarmadas, 1);
  assert.equal(E.explosoes, 0);
});

test('estrelas: aviso a cada 4 jogadas, cai na seguinte; limpar a casa da x2 em 3 limpezas', () => {
  const E = criarPartida({ mec: 5, semente: 12 });
  let aviso = -1;
  for (let k = 0; k < ESTRELA_CADA - 1; k++) {
    const ev = passar(E, k, 7);
    const a = ev.find((e) => e.tipo === 'aviso');
    if (a) aviso = a.i;
  }
  assert.ok(aviso >= 0);
  assert.equal(E.aviso, aviso);
  const ev = passar(E, 4, 7);
  const est = ev.find((e) => e.tipo === 'estrela');
  assert.ok(est);
  assert.equal(E.t.estrela[est.i], 1);
  // fecha a linha da estrela
  const n = 8;
  const ey = Math.floor(est.i / n);
  const ex = est.i % n;
  for (let x = 0; x < n; x++) if (x !== ex) E.t.cor[ey * n + x] = 2;
  E.seq = 0;
  E.semLimpar = 0;
  por(E, 0, MONO);
  const lev = colocar(E, 0, ex, ey);
  assert.ok(lev.some((e) => e.tipo === 'coletou' && e.i === est.i));
  assert.equal(E.dobro, 3);
  assert.equal(E.t.estrela[est.i], 0);
});

test('estrelas: x2 vale nas 3 limpezas seguintes', () => {
  const E = criarPartida({ mec: 5, semente: 13 });
  E.dobro = 3;
  const n = 8;
  for (let x = 0; x < 7; x++) encher(E, [[x, 0]]);
  por(E, 0, MONO);
  const l = colocar(E, 0, 7, 0).find((e) => e.tipo === 'limpou');
  assert.equal(l.dobro, true);
  assert.equal(l.pontos, 20);
  assert.equal(E.dobro, 2);
  assert.ok(n);
});

test('girar: um toque gira 90 graus; fora da mecanica nao gira', () => {
  const E = criarPartida({ mec: 6, semente: 14 });
  por(E, 0, [[0, 0], [1, 0], [2, 0]]);
  assert.ok(girar(E, 0));
  assert.deepEqual(E.bandeja[0].cels, [[0, 0], [0, 1], [0, 2]]);
  const C = criarPartida({ mec: 0, semente: 14 });
  por(C, 0, [[0, 0], [1, 0], [2, 0]]);
  assert.equal(girar(C, 0), null);
});

test('girar: o fim de jogo considera os giros', () => {
  const E = criarPartida({ mec: 6, semente: 15 });
  // so cabe na vertical: a coluna 0 livre, o resto cheio
  for (let y = 0; y < 8; y++) for (let x = 1; x < 8; x++) encher(E, [[x, y]]);
  E.bandeja = [null, null, null];
  por(E, 0, [[0, 0], [1, 0], [2, 0]]);
  assert.equal(semJogada(E), false);
  const C = criarPartida({ mec: 0, semente: 15 });
  for (let y = 0; y < 8; y++) for (let x = 1; x < 8; x++) encher(C, [[x, y]]);
  C.bandeja = [null, null, null];
  por(C, 0, [[0, 0], [1, 0], [2, 0]]);
  assert.equal(semJogada(C), true);
});

test('girar: a bomba gira junto com a celula dela', async () => {
  const { girarPeca } = await import('../src/jogo/sorteio.js');
  const p = { id: 1, forma: 'l4', cels: [[0, 0], [0, 1], [0, 2], [1, 2]], cor: 1, bomba: 3, contador: 7 };
  girarPeca(p);
  // [1,2] -> [-2,1] -> normalizado com min x = -2, min y = 0 -> [0, 1]
  assert.deepEqual(p.cels[p.bomba], [0, 1]);
});

test('galaxia (jogo final): girar e estrelas na mesma partida', () => {
  const E = criarPartida({ mec: 7, semente: 21 });
  por(E, 0, [[0, 0], [1, 0], [2, 0]]);
  assert.ok(girar(E, 0));
  let aviso = false;
  for (let k = 0; k < ESTRELA_CADA - 1; k++) aviso = passar(E, k, 7).some((e) => e.tipo === 'aviso') || aviso;
  assert.ok(aviso);
  assert.ok(passar(E, 4, 7).some((e) => e.tipo === 'estrela'));
});

test('perfeito: limpar e deixar o tabuleiro vazio da bonus x sequencia', async () => {
  const { PONTOS_PERFEITO } = await import('../src/jogo/regras.js');
  const E = criarPartida({ mec: 7, semente: 22 });
  for (let x = 0; x < 7; x++) encher(E, [[x, 3]]);
  por(E, 0, MONO);
  const ev = colocar(E, 0, 7, 3);
  const p = ev.find((e) => e.tipo === 'perfeito');
  assert.ok(p);
  assert.equal(p.pontos, PONTOS_PERFEITO);
  assert.equal(E.pontos, 1 + 10 + PONTOS_PERFEITO);
  assert.equal(E.perfeitos, 1);
  // sobrou bloco: nao e perfeito
  const F = criarPartida({ mec: 7, semente: 22 });
  for (let x = 0; x < 7; x++) encher(F, [[x, 3]]);
  encher(F, [[0, 0]]);
  por(F, 0, MONO);
  assert.ok(!colocar(F, 0, 7, 3).some((e) => e.tipo === 'perfeito'));
});

test('reviver: esvazia as 2 linhas e 2 colunas mais cheias, bandeja nova, so uma vez', async () => {
  const { reviver, podeReviver } = await import('../src/jogo/partida.js');
  const E = criarPartida({ mec: 7, semente: 23 });
  for (let i = 0; i < 64; i++) E.t.cor[i] = (i % 8) === 3 && Math.floor(i / 8) === 3 ? 0 : 2;
  E.bandeja = [null, null, null];
  por(E, 0, [[0, 0], [1, 0]]);
  E.fim = semJogada(E);
  assert.equal(E.fim, true);
  const ev = reviver(E);
  assert.ok(ev && ev[0].tipo === 'reviveu');
  assert.equal(E.fim, false);
  assert.ok(ev[0].cels.length >= 26);
  assert.equal(podeReviver(E), false);
  assert.equal(reviver(E), null);
  assert.ok(E.bandeja.every((p) => p));
});

test('save: serializar e restaurar volta a mesma partida e o mesmo sorteio', async () => {
  const { serializarPartida, restaurarPartida } = await import('../src/jogo/partida.js');
  const { escolherJogada, aplicarJogada } = await import('../src/jogo/bot.js');
  const A = criarPartida({ mec: 7, semente: 24 });
  for (let k = 0; k < 15; k++) aplicarJogada(A, escolherJogada(A));
  const B = restaurarPartida(JSON.parse(JSON.stringify(serializarPartida(A))));
  assert.ok(B);
  assert.deepEqual(serializarPartida(B), serializarPartida(A));
  for (let k = 0; k < 15 && !A.fim; k++) {
    aplicarJogada(A, escolherJogada(A));
    aplicarJogada(B, escolherJogada(B));
  }
  assert.deepEqual(serializarPartida(B), serializarPartida(A));
  // lixo nao restaura
  assert.equal(restaurarPartida(null), null);
  assert.equal(restaurarPartida({ v: 1, mec: 7, cor: [1, 2] }), null);
  const o = serializarPartida(A);
  o.cor[0] = 99;
  assert.equal(restaurarPartida(o), null);
});

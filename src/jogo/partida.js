// Uma partida: estado, jogadas e eventos. Puro e deterministico (a semente decide tudo): o
// prototipo, o bot, os testes e a medicao rodam o mesmo codigo.
//
// Cada acao devolve uma lista de eventos para a cena animar e o som tocar:
//   colocou   { slot, peca, cels: indices, cor }
//   limpou    { grupos: [{ tipo, k, cels, pura }], cels: [{ i, cor }], k, pontos, seq, dobro, puras, origem }
//   sequencia { seq }                 a sequencia subiu (combo)
//   quebrou   { seq }                 a sequencia acabou
//   mana      { mana }                o orbe mudou
//   feitico   {}                      o orbe encheu: ha um Feitico pronto
//   magia     { i, cels: [{ i, cor }], pontos }   o Feitico foi usado na casa i
//   bomba     { i, contador }         contador de uma bomba baixou
//   explodiu  { i, cels }             a bomba zerou e virou entulho
//   aviso     { i }                   uma estrela vai cair na casa i
//   estrela   { i }                   a estrela caiu na casa i
//   coletou   { i }                   a estrela da casa i foi coletada (x2 nas proximas limpezas)
//   girou     { slot }
//   bandeja   {}                      chegaram 3 pecas novas
//   perfeito  { pontos }              a limpeza deixou o tabuleiro vazio (bonus)
//   reviveu   { cels: [{ i, cor }] }  o premio do video: linhas e colunas mais cheias esvaziadas
//   fim       {}                      nenhuma peca cabe
//
// A partida inteira cabe num objeto simples (serializarPartida/restaurarPartida): o jogo salva a
// partida em andamento e volta nela. O sorteio conta as chamadas para recriar o rng no mesmo ponto.

import { criarRng } from '../core/rng.js';
import {
  ESTRELA_CADA, ESTRELA_LIMPEZAS, ESTRELA_MAX, MANA_SEQUENCIA, MANA_UNIDADE, MECANICAS, MULT_PURA,
  PONTOS_CASA, PONTOS_FEITICO, PONTOS_PERFEITO, PONTOS_UNIDADE, REVIVER_LINHAS, REVIVER_MAX, TOLERANCIA_SEQUENCIA,
} from './regras.js';
import {
  ENTULHO, VAZIO, cabe, celulasDasUnidades, criarTabuleiro, totalUnidades, unidadesCheias,
} from './tabuleiro.js';
import { girarPeca, pecaCabe, sortearBandeja } from './sorteio.js';

/**
 * @typedef {object} Partida
 * @property {number} mec
 * @property {import('./regras.js').Regras} regras
 * @property {number} n
 * @property {import('./tabuleiro.js').Tabuleiro} t
 * @property {() => number} rng
 * @property {(import('./sorteio.js').Peca|null)[]} bandeja
 * @property {number} proximoId
 * @property {number} pecasGeradas
 * @property {number} pontos
 * @property {number} seq sequencia de jogadas que limpam (combo)
 * @property {number} melhorSeq
 * @property {number} semLimpar jogadas seguidas sem limpar
 * @property {number} jogadas
 * @property {number} limpezas jogadas que limparam
 * @property {number} unidades unidades limpas no total
 * @property {number} puras linhas de um sabor so
 * @property {number} mana 0..1
 * @property {boolean} feitico ha um Feitico pronto
 * @property {number} feiticos Feiticos usados
 * @property {number} dobro limpezas que ainda valem x2 (estrela)
 * @property {number} aviso casa avisada da proxima estrela (-1 nenhuma)
 * @property {number} coletadas estrelas coletadas
 * @property {number} explosoes bombas que estouraram
 * @property {number} desarmadas bombas limpas a tempo
 * @property {number} perfeitos tabuleiros limpos
 * @property {number} revividas vezes que reviveu nesta partida
 * @property {number} semente
 * @property {number} sorteios chamadas do rng ate agora (para restaurar)
 * @property {boolean} fim
 */

/** Rng com semente que conta as chamadas (o save recria o mesmo ponto do sorteio). */
function rngContado(E, semente, pular = 0) {
  const base = criarRng(semente);
  for (let k = 0; k < pular; k++) base();
  E.sorteios = pular;
  return () => {
    E.sorteios++;
    return base();
  };
}

/**
 * @param {{ mec?: number, semente?: number }} [op]
 * @returns {Partida}
 */
export function criarPartida({ mec = 0, semente = 1 } = {}) {
  const regras = MECANICAS[mec] || MECANICAS[0];
  /** @type {Partida} */
  const E = {
    mec, regras, n: regras.n, t: criarTabuleiro(regras.n), rng: () => 0,
    bandeja: [null, null, null], proximoId: 1, pecasGeradas: 0,
    pontos: 0, seq: 0, melhorSeq: 0, semLimpar: 0, jogadas: 0, limpezas: 0, unidades: 0, puras: 0,
    mana: 0, feitico: false, feiticos: 0, dobro: 0, aviso: -1, coletadas: 0, explosoes: 0, desarmadas: 0,
    perfeitos: 0, revividas: 0, semente: semente >>> 0, sorteios: 0, fim: false,
  };
  E.rng = rngContado(E, E.semente);
  sortearBandeja(E);
  return E;
}

/** Campos numericos e logicos copiados como estao no save. */
const CAMPOS = ['proximoId', 'pecasGeradas', 'pontos', 'seq', 'melhorSeq', 'semLimpar', 'jogadas', 'limpezas', 'unidades',
  'puras', 'mana', 'feitico', 'feiticos', 'dobro', 'aviso', 'coletadas', 'explosoes', 'desarmadas', 'perfeitos', 'revividas',
  'fim'];

/**
 * A partida como objeto simples (JSON).
 * @param {Partida} E
 */
export function serializarPartida(E) {
  /** @type {Record<string, any>} */
  const o = { v: 1, mec: E.mec, semente: E.semente, sorteios: E.sorteios };
  for (const k of CAMPOS) o[k] = /** @type {any} */ (E)[k];
  o.cor = Array.from(E.t.cor);
  o.bomba = Array.from(E.t.bomba);
  o.estrela = Array.from(E.t.estrela);
  o.bandeja = E.bandeja.map((p) => (p ? { ...p, cels: p.cels.map((c) => [c[0], c[1]]) } : null));
  return o;
}

/**
 * Volta uma partida salva; null se o objeto nao serve (versao, tamanho ou valores fora do lugar).
 * @param {any} o
 * @returns {Partida | null}
 */
export function restaurarPartida(o) {
  if (!o || o.v !== 1 || !MECANICAS[o.mec]) return null;
  const regras = MECANICAS[o.mec];
  const n = regras.n;
  const lista = (a, min, max) => Array.isArray(a) && a.length === n * n && a.every((x) => Number.isInteger(x) && x >= min && x <= max);
  if (!lista(o.cor, -1, regras.cores) || !lista(o.bomba, 0, 99) || !lista(o.estrela, 0, 1)) return null;
  if (!Array.isArray(o.bandeja) || o.bandeja.length !== 3) return null;
  for (const p of o.bandeja) {
    if (p === null) continue;
    if (!p || !Array.isArray(p.cels) || !p.cels.length || p.cels.length > 9) return null;
    if (!p.cels.every((c) => Array.isArray(c) && c.length === 2 && c.every((v) => Number.isInteger(v) && v >= 0 && v < 5))) return null;
    if (!Number.isInteger(p.cor) || p.cor < 1 || p.cor > regras.cores) return null;
  }
  const E = criarPartida({ mec: o.mec, semente: o.semente });
  for (const k of CAMPOS) {
    if (typeof o[k] !== typeof /** @type {any} */ (E)[k]) return null;
    /** @type {any} */ (E)[k] = o[k];
  }
  E.t.cor.set(o.cor);
  E.t.bomba.set(o.bomba);
  E.t.estrela.set(o.estrela);
  E.bandeja = o.bandeja.map((p) => (p ? { id: p.id | 0, forma: String(p.forma || ''), cels: p.cels.map((c) => [c[0], c[1]]), cor: p.cor, bomba: Number.isInteger(p.bomba) ? p.bomba : -1, contador: p.contador | 0 } : null));
  E.rng = rngContado(E, E.semente, Math.max(0, o.sorteios | 0));
  if (E.bandeja.every((p) => !p)) sortearBandeja(E);
  E.fim = !E.fim ? semJogada(E) : true;
  return E;
}

/** @param {Partida} E @param {number} slot @param {number} gx @param {number} gy */
export function podeColocar(E, slot, gx, gy) {
  const p = E.bandeja[slot];
  return !E.fim && !!p && cabe(E.t, p.cels, gx, gy);
}

/** A peca do slot cabe em algum lugar (girando, se a mecanica deixa)? @param {Partida} E @param {number} slot */
export function slotCabe(E, slot) {
  const p = E.bandeja[slot];
  return !!p && pecaCabe(E.t, p.cels, !!E.regras.girar);
}

/** Nenhuma jogada possivel? @param {Partida} E */
export function semJogada(E) {
  if (E.feitico) return false;
  for (let s = 0; s < E.bandeja.length; s++) if (slotCabe(E, s)) return false;
  return true;
}

/**
 * Tira as celulas do tabuleiro (limpeza ou Feitico): recolhe estrelas e desarma bombas.
 * @param {Partida} E
 * @param {Iterable<number>} indices
 * @param {any[]} ev
 * @returns {{ i: number, cor: number }[]}
 */
function remover(E, indices, ev) {
  const t = E.t;
  const out = [];
  for (const i of indices) {
    if (t.cor[i] === VAZIO) continue;
    out.push({ i, cor: t.cor[i] });
    if (t.bomba[i] > 0) E.desarmadas++;
    t.cor[i] = VAZIO;
    t.bomba[i] = 0;
    if (t.estrela[i]) {
      t.estrela[i] = 0;
      E.coletadas++;
      E.dobro = ESTRELA_LIMPEZAS;
      ev.push({ tipo: 'coletou', i });
    }
  }
  return out;
}

/**
 * Limpa as unidades cheias. Com `pontuar`, conta sequencia, pontos, mana e o x2 da estrela.
 * @param {Partida} E
 * @param {any[]} ev
 * @param {boolean} pontuar
 * @param {number} origem casa central da jogada (de onde a limpeza se espalha)
 * @returns {number} unidades limpas
 */
function limpar(E, ev, pontuar, origem) {
  const t = E.t;
  const n = E.n;
  const R = E.regras;
  const u = unidadesCheias(t.cor, n, !!R.quadrantes);
  const k = totalUnidades(u);
  if (!k) return 0;
  const grupos = celulasDasUnidades(u, n).map((g) => {
    const c0 = t.cor[g.cels[0]];
    const pura = !!R.sabores && c0 > 0 && g.cels.every((i) => t.cor[i] === c0);
    return { ...g, pura };
  });
  const todas = new Set();
  for (const g of grupos) for (const i of g.cels) todas.add(i);
  let pontos = 0;
  let dobro = false;
  const puras = grupos.filter((g) => g.pura).length;
  if (pontuar) {
    E.seq++;
    if (E.seq > E.melhorSeq) E.melhorSeq = E.seq;
    E.semLimpar = 0;
    E.limpezas++;
    E.unidades += k;
    E.puras += puras;
    let base = 0;
    for (const g of grupos) base += PONTOS_UNIDADE * k * (g.pura ? MULT_PURA : 1);
    pontos = base * E.seq;
    if (E.dobro > 0) {
      pontos *= 2;
      E.dobro--;
      dobro = true;
    }
    E.pontos += pontos;
    if (R.mana && !E.feitico) {
      E.mana = Math.min(1, E.mana + MANA_UNIDADE * k + MANA_SEQUENCIA * (E.seq - 1));
      ev.push({ tipo: 'mana', mana: E.mana });
    }
  }
  const cels = remover(E, todas, ev);
  ev.push({ tipo: 'limpou', grupos, cels, k, pontos, seq: pontuar ? E.seq : 0, dobro, puras, origem });
  if (pontuar && E.seq >= 2) ev.push({ tipo: 'sequencia', seq: E.seq });
  if (pontuar && t.cor.every((c) => c === VAZIO)) {
    const bonus = PONTOS_PERFEITO * Math.max(1, E.seq);
    E.pontos += bonus;
    E.perfeitos++;
    ev.push({ tipo: 'perfeito', pontos: bonus });
  }
  return k;
}

/** Bombas: o contador baixa; a que zera vira entulho 3x3. @param {Partida} E @param {Set<number>} novas @param {any[]} ev */
function tiquetaquear(E, novas, ev) {
  const t = E.t;
  const n = E.n;
  let estourou = false;
  for (let i = 0; i < t.bomba.length; i++) {
    if (t.bomba[i] <= 0 || novas.has(i)) continue;
    t.bomba[i]--;
    if (t.bomba[i] > 0) {
      ev.push({ tipo: 'bomba', i, contador: t.bomba[i] });
      continue;
    }
    const x0 = i % n;
    const y0 = Math.floor(i / n);
    const cels = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      const j = y * n + x;
      if (j !== i && t.bomba[j] > 0) continue; // outra bomba fica (estoura no tempo dela)
      t.cor[j] = ENTULHO;
      t.estrela[j] = 0;
      if (j === i) t.bomba[j] = 0;
      cels.push(j);
    }
    E.explosoes++;
    estourou = true;
    ev.push({ tipo: 'explodiu', i, cels });
  }
  // o entulho pode fechar uma linha: ela sai, sem pontos
  if (estourou) limpar(E, ev, false, -1);
}

/** Estrelas: a avisada cai; a cada ESTRELA_CADA jogadas uma nova e avisada. @param {Partida} E @param {any[]} ev */
function estrelas(E, ev) {
  const t = E.t;
  const ativas = () => { let c = 0; for (let i = 0; i < t.estrela.length; i++) c += t.estrela[i]; return c; };
  const casaVazia = () => {
    const livres = [];
    for (let i = 0; i < t.cor.length; i++) if (t.cor[i] === VAZIO && !t.estrela[i]) livres.push(i);
    return livres.length ? livres[Math.floor(E.rng() * livres.length)] : -1;
  };
  if (E.aviso >= 0) {
    let i = E.aviso;
    if (t.cor[i] !== VAZIO || t.estrela[i]) i = casaVazia();
    E.aviso = -1;
    if (i >= 0 && ativas() < ESTRELA_MAX) {
      t.estrela[i] = 1;
      ev.push({ tipo: 'estrela', i });
    }
  }
  if (E.jogadas % ESTRELA_CADA === ESTRELA_CADA - 1 && ativas() < ESTRELA_MAX) {
    const i = casaVazia();
    if (i >= 0) {
      E.aviso = i;
      ev.push({ tipo: 'aviso', i });
    }
  }
}

/** Depois de cada jogada: Feitico pronto, bandeja nova e fim de jogo. @param {Partida} E @param {any[]} ev */
function fecharJogada(E, ev) {
  if (E.regras.mana && !E.feitico && E.mana >= 1) {
    E.feitico = true;
    E.mana = 0;
    ev.push({ tipo: 'feitico' });
    ev.push({ tipo: 'mana', mana: 0 });
  }
  if (E.bandeja.every((p) => !p)) {
    sortearBandeja(E);
    ev.push({ tipo: 'bandeja' });
  }
  if (semJogada(E)) {
    E.fim = true;
    ev.push({ tipo: 'fim' });
  }
}

/**
 * Coloca a peca do slot com o canto em (gx, gy).
 * @param {Partida} E
 * @param {number} slot
 * @param {number} gx
 * @param {number} gy
 * @returns {any[] | null} eventos, ou null se a jogada nao vale
 */
export function colocar(E, slot, gx, gy) {
  if (!podeColocar(E, slot, gx, gy)) return null;
  const p = /** @type {import('./sorteio.js').Peca} */ (E.bandeja[slot]);
  const t = E.t;
  const n = E.n;
  const ev = [];
  const novas = new Set();
  let sx = 0;
  let sy = 0;
  p.cels.forEach(([cx, cy], k) => {
    const i = (gy + cy) * n + gx + cx;
    t.cor[i] = p.cor;
    if (k === p.bomba) t.bomba[i] = p.contador;
    novas.add(i);
    sx += gx + cx;
    sy += gy + cy;
  });
  const origem = Math.round(sy / p.cels.length) * n + Math.round(sx / p.cels.length);
  E.bandeja[slot] = null;
  E.pontos += PONTOS_CASA * p.cels.length;
  E.jogadas++;
  ev.push({ tipo: 'colocou', slot, peca: p, cels: [...novas], cor: p.cor });
  const k = limpar(E, ev, true, origem);
  if (!k) {
    E.semLimpar++;
    if (E.seq > 0 && E.semLimpar >= TOLERANCIA_SEQUENCIA) {
      ev.push({ tipo: 'quebrou', seq: E.seq });
      E.seq = 0;
    }
  }
  if (E.regras.bombas) tiquetaquear(E, novas, ev);
  if (E.regras.estrelas) estrelas(E, ev);
  fecharJogada(E, ev);
  return ev;
}

/**
 * Usa o Feitico na casa (gx, gy): limpa a linha e a coluna dela (qualquer bloco, ate entulho).
 * Nao conta como jogada (nao mexe na sequencia, nas bombas nem nas estrelas).
 * @param {Partida} E
 * @param {number} gx
 * @param {number} gy
 * @returns {any[] | null}
 */
export function usarFeitico(E, gx, gy) {
  const n = E.n;
  if (E.fim || !E.feitico || gx < 0 || gy < 0 || gx >= n || gy >= n) return null;
  const ev = [];
  const alvo = new Set();
  for (let k = 0; k < n; k++) {
    alvo.add(gy * n + k);
    alvo.add(k * n + gx);
  }
  const cels = remover(E, alvo, ev);
  const pontos = PONTOS_FEITICO * cels.length;
  E.pontos += pontos;
  E.feitico = false;
  E.feiticos++;
  ev.push({ tipo: 'magia', i: gy * n + gx, cels, pontos });
  if (semJogada(E)) {
    E.fim = true;
    ev.push({ tipo: 'fim' });
  }
  return ev;
}

/**
 * Gira a peca do slot 90 graus (so na mecanica girar).
 * @param {Partida} E
 * @param {number} slot
 * @returns {any[] | null}
 */
export function girar(E, slot) {
  const p = E.bandeja[slot];
  if (E.fim || !E.regras.girar || !p) return null;
  girarPeca(p);
  return [{ tipo: 'girou', slot }];
}

/** Ainda da para reviver nesta partida? @param {Partida} E */
export function podeReviver(E) {
  return E.revividas < REVIVER_MAX;
}

/**
 * Premio do video recompensado: esvazia as REVIVER_LINHAS linhas e colunas mais cheias e sorteia uma
 * bandeja nova (com a regra anti-frustracao). Tira o fim de jogo.
 * @param {Partida} E
 * @returns {any[] | null}
 */
export function reviver(E) {
  if (!podeReviver(E)) return null;
  const n = E.n;
  const t = E.t;
  const cheias = (eLinha) => Array.from({ length: n }, (_, k) => {
    let c = 0;
    for (let j = 0; j < n; j++) if (t.cor[eLinha ? k * n + j : j * n + k] !== VAZIO) c++;
    return { k, c };
  }).sort((a, b) => b.c - a.c || a.k - b.k).slice(0, REVIVER_LINHAS);
  const alvo = new Set();
  for (const { k } of cheias(true)) for (let j = 0; j < n; j++) alvo.add(k * n + j);
  for (const { k } of cheias(false)) for (let j = 0; j < n; j++) alvo.add(j * n + k);
  const ev = [];
  const cels = remover(E, alvo, ev);
  E.revividas++;
  E.fim = false;
  E.seq = 0;
  E.semLimpar = 0;
  sortearBandeja(E);
  ev.unshift({ tipo: 'reviveu', cels });
  ev.push({ tipo: 'bandeja' });
  if (semJogada(E)) {
    E.fim = true;
    ev.push({ tipo: 'fim' });
  }
  return ev;
}

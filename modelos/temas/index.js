// Os 6 temas dos modelos, na ordem das fichas, e os nomes das mecanicas (com acento: fica fora de
// src/jogo, que e ASCII).
import runas from './runas.js';
import zen from './zen.js';
import doceria from './doceria.js';
import neon from './neon.js';
import galaxia from './galaxia.js';
import recife from './recife.js';

export const TEMAS = [runas, zen, doceria, neon, galaxia, recife];

export const NOMES_MEC = [
  'Clássico (sem extra)',
  'Orbe de mana',
  'Quadrantes 3×3 (9×9)',
  'Linha de um sabor',
  'Bombas-relógio',
  'Estrelas cadentes',
  'Girar a peça',
  'Girar + Estrelas (jogo final)',
];

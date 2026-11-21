// Utilitarios dos temas.

/** Hash pequeno e deterministico em 0..1 (posicoes de estrelas, folhas, bolhas...). */
export const h = (i, k = 1) => {
  let x = Math.imul(i * 374761393 + k * 668265263, 1274126177) >>> 0;
  x ^= x >>> 13;
  return (Math.imul(x, 1103515245) >>> 0) / 4294967296;
};

/** Retangulo de uma unidade limpa (linha, coluna ou quadrante) em px. */
export function areaGrupo(L, g) {
  const { tab, cs, n } = L;
  if (g.tipo === 'linha') return { x: tab.x, y: tab.y + g.k * cs, w: tab.w, h: cs };
  if (g.tipo === 'coluna') return { x: tab.x + g.k * cs, y: tab.y, w: cs, h: tab.h };
  const m = n / 3;
  return { x: tab.x + (g.k % m) * 3 * cs, y: tab.y + Math.floor(g.k / m) * 3 * cs, w: cs * 3, h: cs * 3 };
}

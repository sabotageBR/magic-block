// Todo texto visivel do jogo, nos tres idiomas do californiagames.io (pt-BR, en, es; o portal so manda
// esses). O nucleo (src/jogo) so emite eventos; a interface traduz.

/** @type {Record<string, Record<string, string>>} */
export const TEXTOS = {
  pt: {
    titulo: 'Magic Block',
    pausa: 'Pausa', continuar: 'Continuar', recomecar: 'Recomeçar',
    efeitos: 'Efeitos', musica: 'Música', vibracao: 'Vibração', ligado: 'ligado', desligado: 'desligado',
    semEspaco: 'Sem espaço!', pontos: 'Pontos', recorde: 'Recorde', novoRecorde: 'Novo recorde!',
    reviver: 'Reviver', reviverDica: 'Veja um vídeo e abra espaço no tabuleiro', videoFalhou: 'Vídeo indisponível agora',
    jogarDeNovo: 'Jogar de novo',
    combo: 'COMBO', perfeito: 'PERFEITO!', puro: 'PURO',
    ajuda: 'Arraste as peças para o tabuleiro. Linha ou coluna cheia some. Toque numa peça para girá-la. Limpe a casa da estrela para ganhar pontos em dobro.',
    teclado: 'Teclado: 1 a 3 escolhem a peça, setas movem, R gira, Enter coloca, Esc pausa.',
    'bt.pausa': 'Pausar',
  },
  en: {
    titulo: 'Magic Block',
    pausa: 'Paused', continuar: 'Resume', recomecar: 'Restart',
    efeitos: 'Sound effects', musica: 'Music', vibracao: 'Vibration', ligado: 'on', desligado: 'off',
    semEspaco: 'No space left!', pontos: 'Score', recorde: 'Best', novoRecorde: 'New best!',
    reviver: 'Revive', reviverDica: 'Watch a video to clear space on the board', videoFalhou: 'Video not available right now',
    jogarDeNovo: 'Play again',
    combo: 'COMBO', perfeito: 'PERFECT!', puro: 'PURE',
    ajuda: 'Drag the pieces onto the board. A full row or column disappears. Tap a piece to rotate it. Clear the star cell to earn double points.',
    teclado: 'Keyboard: 1 to 3 pick a piece, arrows move, R rotates, Enter places, Esc pauses.',
    'bt.pausa': 'Pause',
  },
  es: {
    titulo: 'Magic Block',
    pausa: 'Pausa', continuar: 'Continuar', recomecar: 'Reiniciar',
    efeitos: 'Efectos', musica: 'Música', vibracao: 'Vibración', ligado: 'activado', desligado: 'desactivado',
    semEspaco: '¡Sin espacio!', pontos: 'Puntos', recorde: 'Récord', novoRecorde: '¡Nuevo récord!',
    reviver: 'Revivir', reviverDica: 'Mira un video y libera espacio en el tablero', videoFalhou: 'Video no disponible ahora',
    jogarDeNovo: 'Jugar de nuevo',
    combo: 'COMBO', perfeito: '¡PERFECTO!', puro: 'PURO',
    ajuda: 'Arrastra las piezas al tablero. Una fila o columna llena desaparece. Toca una pieza para girarla. Limpia la casilla de la estrella para ganar puntos dobles.',
    teclado: 'Teclado: 1 a 3 eligen la pieza, flechas mueven, R gira, Enter coloca, Esc pausa.',
    'bt.pausa': 'Pausa',
  },
};

/**
 * @param {string} lang @param {string} chave @param {Record<string, string|number>} [vars]
 */
export function texto(lang, chave, vars) {
  const tab = TEXTOS[lang] || TEXTOS.en;
  let s = tab[chave] !== undefined ? tab[chave] : TEXTOS.en[chave] !== undefined ? TEXTOS.en[chave] : chave;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace('{' + k + '}', String(v));
  return s;
}

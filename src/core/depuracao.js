// Parametros de teste na URL. So valem em file://, localhost, 127.0.0.1 e na rede local
// (192.168.x, 10.x: o celular pela Wi-Fi). No portal nada disso existe.
// Unico modulo do jogo que le a URL (vigiado por test/estilo.test.js).
//   ?semente=123       semente fixa da partida (prints reprodutiveis)
//   ?novo              ignora a partida salva
//   ?pre=12            comeca com N jogadas do bot ja feitas
//   ?auto[=ruido]      o bot joga sozinho, arrastando as pecas como uma pessoa
//   ?fixo              cena parada: uma peca no ar com a previa acesa (arte e thumb)
//   ?filme=12&dur=9000&larg=360   gera os quadros de um video em <pre id="filme"> sem relogio real
//   ?semanuncio        nao pede intervalo comercial
//   ?semtutorial       sem a mao do tutorial
//   ?lang=pt           forca o idioma (pt, en, es)
//   ?semhud            esconde o botao de pausa e o placar (arte)
//   ?debug             fps e ms do desenho no canto
// Em todo endereco local o jogo tambem expoe window.__jogo (os roteiros de prova e de midia o usam).

export function lerDepuracao() {
  const base = {
    local: false, ganchos: false, semente: 0, novo: false, pre: 0, auto: false, ruido: 0, fixo: false,
    filme: 0, dur: 9000, larg: 360, semAnuncio: false, semTutorial: false, lang: '', semHud: false, debug: false,
  };
  let local = false;
  try {
    local = location.protocol === 'file:'
      || /^(127\.0\.0\.1|localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
  } catch {
    local = false;
  }
  if (!local) return base;
  const q = new URLSearchParams(location.search || location.hash.slice(1));
  const num = (/** @type {string} */ k, /** @type {number} */ d) => (q.has(k) && q.get(k) !== '' && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  const filme = Math.max(0, num('filme', 0) | 0);
  return Object.assign(base, {
    local: true,
    ganchos: true,
    semente: num('semente', 0) >>> 0,
    novo: q.has('novo') || q.has('semente') || filme > 0,
    pre: Math.max(0, num('pre', q.has('fixo') ? 12 : 0) | 0),
    auto: q.has('auto') || filme > 0,
    ruido: Math.max(0, num('auto', 0)),
    fixo: q.has('fixo'),
    filme,
    dur: Math.max(500, num('dur', 9000)),
    larg: Math.max(120, num('larg', 360)),
    semAnuncio: q.has('semanuncio') || filme > 0,
    semTutorial: q.has('semtutorial') || q.has('auto') || q.has('fixo') || filme > 0,
    lang: q.get('lang') || '',
    semHud: q.has('semhud'),
    debug: q.has('debug'),
  });
}

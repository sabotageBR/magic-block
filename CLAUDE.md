# CLAUDE.md

Magic Block é um quebra-cabeça de blocos no espaço para o californiagames.io (e, com build própria, para a Y8). A peça é arrastada até a grade 8×8 e linhas e colunas cheias somem. Um toque gira a peça. Estrelas cadentes caem numa casa e, quando essa casa é limpa, as 3 limpezas seguintes valem ×2. Feito em HTML + JavaScript puro. Não é cópia de nenhum jogo: nome, arte, sons e pontuação são próprios.

## Histórico

1. **Rodada de 6 modelos jogáveis** (`modelos/`, ver `modelos/README.md`). Em 2026-11-18 o usuário escolheu o **tema Galáxia** com as mecânicas **Girar e Estrelas**, que é a mecânica 7, `galaxia`, em `src/jogo/regras.js`.
2. **Jogo final** (versão 1.0.0): `index.html` e `src/main.js`, nascido só para o californiagames.io.
   - A base é o `../jogos/tic-tac-toe-deluxe`: camada da SDK, armazenamento, laço, áudio, háptico e empacotador.
   - O pacote de distribuição está em `../jogos/distribuicao/magic-block/californiagames/`, com zip, mídias, ficha, roteiro da prova e notas.
   - A especificação é `../jogos/distribuicao/INTEGRACAO.md`.
3. **Build da Y8** (2026-11-20), do mesmo código 1.0.0: `npm run empacotar:y8`. O pacote está em `../jogos/distribuicao/magic-block/y8/` (zip em `build/` e `ficha.md`).
   - Adaptador `src/core/portais/y8.js` sobre `fila-sdk.js`, copiados do kit multiportal (`../jogos/distribuicao/kit/src/core/portais/`). Só a build da Y8 os liga: o empacotador troca o `src/core/plataforma.js` por um reexport de `portais/y8.js`. A build do californiagames não leva `portais/`.
   - Os ids do Developer Portal (`appId`, `gameId`) ficam em `package.json` → `kit.ids.y8`, o mesmo lugar dos jogos do kit. O empacotador os grava no `IDS` do adaptador.
   - O `src/main.js` lê marcas do portal, que a camada do californiagames não tem, então o comportamento lá não muda: `intervaloSoNoClique` (no máximo 1 intervalo a cada 180 s, contando da abertura), `pausaSoNoAnuncio` (congela e cala só no `beforeAd`), `pausaNoBlur` (perder o foco abre a pausa) e `lacoAposInit` falso (o laço não espera o SDK async).

## Stack e regras

- **Sem dependências:** ES modules nativos, Canvas 2D e WebAudio. Nada de bundler, framework ou TypeScript. As ferramentas usam Node 22+, Google Chrome e ffmpeg.
- **`src/main.js` é o único dono** do SDK (`core/plataforma.js`), do DOM, do áudio e do save. Ele também é o único que importa a camada da SDK.
- **`gameplayStart` só em `jogadorAgiu()`**, que é chamada só nos ouvintes `pointerdown` e `keydown`. O `test/estilo.test.js` vigia isso.
- **`src/jogo/`, o núcleo puro:**
  - não usa DOM, relógio nem `Math.random`; o sorteio vem de `core/rng.js`, com semente e contador (o save recria o mesmo ponto);
  - é ASCII fora dos comentários;
  - só importa `src/jogo/` e `core/rng.js`.
- **Render:** `src/render/cena.js` é a cena comum e `src/render/tema.js` é o tema do jogo, a Galáxia do modelo 5. O tema tem os ganchos `multi`, `combo` e `perfeito`. Nada de `shadowBlur` por quadro, só dentro do sprite.
- **Som:**
  - `src/som/galaxia.js`: sinos FM na pentatônica de Mi. As camadas crescem por momento: 1 linha, 2 linhas, 3 ou mais (supernova), combo que sobe a escala, tabuleiro limpo.
  - `src/som/musica.js`: pad generativo e sinos esparsos.
  - `src/core/audio.js`: reverb sintetizado, eco e barramentos separados para efeitos e música.
  - O que repete a cada jogada fica baixo. Nada de onda quadrada ou serrote.
- **Armazenamento:** só `src/core/armazenamento.js` toca o `localStorage`, com o prefixo `magicblock.`: recorde, prefs, tutorial e a partida em andamento. Nunca `clear()`.
- **Parâmetros de teste da URL** (`?auto`, `?fixo`, `?filme`, `?pre`, `?semente`, `?lang`…) só valem em endereço local (`src/core/depuracao.js`). No portal não existem.
- **Telas:** retrato primeiro (390×844), depois paisagem e desktop. O botão de pausa é DOM, no lugar que o layout reserva (`L.pausa`).
- **Estilo:** código, comentários, docs e respostas em português, com comentários em ASCII. 2 espaços, aspas simples, ponto e vírgula, JSDoc.
- **Git:** commit e push só com o OK do usuário.

## Comandos

```bash
npm test                 # núcleo, mecânicas, save, fronteiras do jogo e dos modelos, sons, textos (pt/en/es)
npm run servir           # http://127.0.0.1:5420/  (o jogo; /modelos/ tem os modelos e /modelos/sons.html os sons)
npm run lan              # o mesmo na Wi-Fi, para o celular
npm run sons             # renderiza cada som offline e mede pico/RMS (WAVs em .tmp/sons/)
npm run empacotar        # testes + build do californiagames (dist-californiagames/*.zip, copiado para a distribuicao)
npm run empacotar:y8     # testes + build da Y8 (dist-y8/magic-block-y8-<versao>.zip, copiado para a distribuicao)
npm run provar:y8        # a build da Y8 no Chrome headless: SDK bloqueado e SDK falso (ids, intersticial, pausa, premio, foco)
node tools/empacotar.mjs [--alvo=y8] --sem-copia   # confere e zipa sem trocar o pacote da distribuicao
npm run midias           # screenshots, preview, thumb e capa a partir de dist/ (depois do empacotar)
npm run medir            # bot em todas as mecânicas -> modelos/medidas.json
```

**Prova do portal** (de `../jogos/distribuicao/`):

```bash
node ferramentas/provar.mjs magic-block [--mobile --largura=540 --altura=960 --escala=2 --lang=en]
node ferramentas/conferir.mjs magic-block
node ferramentas/ficha-md.mjs magic-block
```

No macOS, o Chrome headless não abre janela com menos de 500 px de largura. Por isso os prints passam pelo CDP com `Emulation.setDeviceMetricsOverride` (`tools/cdp.mjs`), não por `--screenshot`.

## Mapa

| Caminho | O que é |
|---|---|
| `src/main.js` | Jogo: entrada (arrasto, toque gira, teclado 1–3, setas, R, Enter), menus, fim com Reviver, SDK, save e o bot do `?auto` |
| `src/jogo/partida.js` | Estado e ações (`colocar`, `girar`, `reviver`, `usarFeitico`); serializar e restaurar; eventos para a cena e o som |
| `src/jogo/regras.js` | As 8 mecânicas (7 = galáxia, a do jogo) e o balanceamento |
| `src/jogo/sorteio.js`, `formas.js`, `tabuleiro.js`, `bot.js` | Bandeja anti-frustração, poliminós, grade e bot guloso |
| `src/render/cena.js`, `tema.js`, `layout.js`, `particulas.js` | Desenho, tema Galáxia, geometria e efeitos |
| `src/som/galaxia.js`, `musica.js` | Efeitos e música |
| `src/i18n/textos.js` | Textos pt, en, es |
| `modelos/` | Rodada de modelos (histórico), hub, estúdio de sons |
| `src/core/plataforma.js` | Camada da PlataformaSDK do californiagames.io (na build da Y8 vira o reexport de `portais/y8.js`) |
| `src/core/portais/y8.js`, `fila-sdk.js` | Adaptador da Y8 (SDK 2-0), cópia do kit multiportal; só na build da Y8 |
| `tools/empacotar.mjs`, `midias.mjs` | Pacote (`--alvo=californiagames` ou `y8`) e mídias do californiagames.io |
| `tools/provar-y8.mjs` | Prova da build da Y8 pelo CDP (`tools/cdp.mjs`) |

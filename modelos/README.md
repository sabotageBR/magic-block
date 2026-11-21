# Modelos do Magic Block

> **Escolha (2026-11-18):** tema **Galáxia** com as mecânicas **Girar + Estrelas** juntas (mecânica 7, `galaxia`). O jogo final está em `index.html` e `src/main.js`, e o pacote do californiagames.io está em `../jogos/distribuicao/magic-block/`. Esta pasta fica como histórico. O estúdio `modelos/sons.html` toca os sons novos do jogo.

Seis protótipos jogáveis para escolher o jogo antes de desenvolver. Todos rodam o mesmo núcleo
(`src/jogo/`) e a mesma cena (`src/render/`); cada modelo junta um **tema visual**
(`modelos/temas/*.js`) a uma **mecânica extra** (`src/jogo/regras.js`). Tema e mecânica são
independentes: qualquer tema roda com qualquer mecânica.

## Como ver

```bash
npm run servir                     # http://127.0.0.1:5420/modelos/  (hub com as fichas)
npm run lan                        # o mesmo, aberto na Wi-Fi para testar no celular
```

- `modelos/index.html`: hub com as 6 fichas (vídeo do bot jogando, regra, a favor, risco, medição), combinador de tema e mecânica, e as perguntas no final.
- `modelos/jogar.html#tema=N`: o protótipo. Teclas <kbd>1</kbd>–<kbd>6</kbd> trocam o modelo, <kbd>R</kbd> recomeça, <kbd>A</kbd> liga o bot.
  Parâmetros: `mec=0..6` (combinar), `semente=N`, `auto`, `pre=N`, `fixo` (cena de print), `filme=fps` (quadros do GIF), `limpo`.
- Os prints (retrato 390×844, paisagem 844×390, desktop 1280×720), as folhas de comparação e os vídeos ficam em `modelos/prints/`.

## O núcleo comum

- Tabuleiro 8×8 (9×9 nos Quadrantes), bandeja com 3 peças. Quando as 3 são usadas, chegam mais 3.
- Formas de 1 a 9 casas, sorteadas por peso e com semente. A cada bandeja nova, pelo menos uma peça cabe quando isso é possível (anti-frustração).
- **Arrasto:**
  - no toque, a peça sobe acima do dedo (0,7 casa);
  - o fantasma mostra onde ela cai;
  - as linhas que vão sumir acendem na cor da peça;
  - soltar fora devolve a peça animada.
- **Pontos:**
  - 1 por casa colocada;
  - 10·k² por k unidades limpas juntas;
  - tudo multiplicado pela sequência de jogadas que limpam. Três jogadas sem limpar zeram a sequência.
- A peça que não cabe em lugar nenhum fica apagada na bandeja. A primeira jogada é ensinada por uma mão animada.
- Arte desenhada em código, com os sprites dos blocos em cache. Os sons são sintetizados (`src/som/sons.js`, com o timbre de cada tema). Nenhum asset de terceiros, só a fonte Fredoka (OFL).

## Comparação

| # | Modelo | Regra | A favor | Contra |
|---|---|---|---|---|
| 1 | **Runas Arcanas** | Orbe de mana: limpar enche; cheio, vira um Feitiço que limpa a linha e a coluna onde cair | Casa com o nome; visual premium; decisão de quando gastar o poder | Fácil demais com a mana atual; fundo escuro pede contraste |
| 2 | **Jardim Zen** | 9×9; quadrante 3×3 cheio também limpa | Calmo, partidas longas, público adulto | Regra conhecida no gênero; ficou fácil demais |
| 3 | **Doceria** | Cada peça tem um sabor; linha de um sabor só vale ×3 | Fofo e amplo; ícone por sabor para daltônicos | A linha pura é rara e pode passar despercebida |
| 4 | **Neon Arcade** | Bomba-relógio a cada 8 peças; zerou, vira entulho 3×3 | Tensão, partidas curtas, thumbnail forte | Estressa quem quer relaxar; visual saturado |
| 5 | **Galáxia** | Estrela avisada cai numa casa; limpar a casa dá ×2 em 3 limpezas | Bonito, calmo, regra só positiva | Menos original sozinha |
| 6 | **Recife** | Um toque gira a peça; em troca, mais pentominós | Acessível; o gênero não gira | Tira tensão; toque e arrasto precisam de cuidado |

### Medição (`npm run medir`, 100 partidas por mecânica)

"Bom" é o bot sem ruído; "médio" é o bot com ruído de 40 na nota, que erra como uma pessoa distraída. Os minutos supõem 3,2 s por jogada.

| Mecânica | Jogadas (bom) | Min (bom) | Jogadas (médio) | Min (médio) | Extra por partida (bom) |
|---|---:|---:|---:|---:|---|
| Clássico (controle) | 140 | 7,5 | 44 | 2,4 | — |
| Orbe de mana | 364 | 19,4 | 67 | 3,6 | 26,5 Feitiços |
| Quadrantes 9×9 | 2.143+ | 114,3 | 82 | 4,4 | — (15 partidas bateram o limite de 5.000) |
| Sabores | 135 | 7,2 | 45 | 2,4 | 2,1 linhas puras |
| Bombas | 157 | 8,3 | 39 | 2,1 | 3,4 explosões |
| Estrelas | 120 | 6,4 | 43 | 2,3 | 17,3 estrelas |
| Girar | 211 | 11,2 | 73 | 3,9 | — |

O que a medição mostra:

- **Quadrantes 9×9** é muito mais fácil que o 8×8. Para usar, precisa de peças maiores ou de menos peças pequenas.
- **Orbe de mana** deixa o bom jogador 2,6× mais tempo vivo. A mana precisa encher mais devagar, por exemplo 0,15 por unidade em vez de 0,25.
- As **Bombas** encurtam a partida do jogador médio, que era o objetivo: mais tensão.

## Minha recomendação

1. **Runas Arcanas com Orbe de mana.**
   - É a que mais tem cara de jogo próprio e casa com o nome Magic Block.
   - O Feitiço dá um momento de virada que o jogador escolhe quando usar.
   - O visual de cristal sobre pedra rúnica se destaca na vitrine de um portal.
   - Antes de fechar, falta calibrar a mana.
2. **Galáxia com Estrelas cadentes.** É calma e bonita, com uma regra só positiva que aparece o tempo todo (17 estrelas por partida).

**Os outros temas viram mundos desbloqueáveis.** Como tema e mecânica são separados, os outros 4 visuais podem entrar no jogo final como mundos liberados por pontuação. As Bombas servem como modo desafio. Eu não usaria os Quadrantes como regra principal: lembram demais o "block sudoku" e ficaram fáceis.

## Por que não é cópia

- O gênero (encaixar poliminós e limpar linhas) é livre.
- Nome, arte, sons, pontuação e textos são próprios.
- Não há o item de limpar o tabuleiro da referência. Cada modelo tem uma regra própria que muda a decisão da jogada.

## Ferramentas

| Comando | O que faz |
|---|---|
| `npm test` | Núcleo, mecânicas, fronteiras do código e contrato dos temas |
| `npm run medir` | Medição com o bot; grava `modelos/medidas.json`, que o hub lê |
| `npm run prints` | Prints e folhas de comparação (Chrome headless pelo CDP, viewport emulado) |
| `npm run gifs` | GIF, MP4 e capa de cada modelo (bot jogando, quadros gerados sem relógio real) |
| `npm run artifact` | Monta `.tmp/artifact/` para publicar o hub como Artifact |

Precisam de Node 22+, Google Chrome e ffmpeg.

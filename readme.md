# PokéTeam

Site estático em HTML/CSS/JavaScript. Abra `index.html` em um navegador moderno com internet para consultar a PokéAPI. Para evitar restrições de `file://` em alguns navegadores, é recomendado servir a pasta localmente (por exemplo, com a extensão Live Server do VS Code ou `python -m http.server`).

## Dados e persistência
- National Dex: PokéAPI, #0001–#1025.
- Legendary/Mythical: flags `is_legendary` e `is_mythical` de `pokemon-species` da PokéAPI.
- Ultra Beasts, iniciais, Mega e Gigantamax: listas de espécies auditadas e mantidas no `app.js`.
- Favoritos, times, roleta, recentes e cache: `localStorage`.
- Imagens: repositório oficial de sprites usado pelo ecossistema PokéAPI.

## Observação de classificação
Ultra Beasts ficam separadas de Legendary; Necrozma não é tratado como Ultra Beast. O filtro “Dynamax/Gigantamax” representa espécies com forma Gigantamax, conforme solicitado.


## Base universal do PokéTeam

O PokéTeam usa como critérios centrais apenas informações que permanecem úteis de forma ampla entre jogos, anime, fangames e mods:

- tipos elementais;
- fraquezas;
- resistências;
- imunidades;
- cobertura elemental;
- diversidade de tipos;
- sinergia e complementaridade entre Pokémon.

Mecânicas que variam entre jogos ou sistemas não entram como base das recomendações, incluindo Moves, Nature, EVs/IVs, Abilities, itens, Terastalização e regras competitivas específicas.

O objetivo do Team Builder é sugerir composições universais por tipagem e sinergia elemental.

# Memory Quiz

A small React/Vite memory quiz for learning US states, Australian states and territories, continent country maps, and the NATO phonetic alphabet.

Live site: https://memoryquiz.pages.dev/

## Modes

- Name: a random map area or alphabet letter is highlighted and the typed answer turns green or red.
- List: start with a blank map or list, type names, and correct answers fill in.

## Bookmarks

The URL hash selects the quiz, so links can be bookmarked: `#us`, `#australia`, `#asia`, `#africa`, `#north-america`, `#south-america`, `#europe`, `#nato`. Add `/list` for List mode, e.g. `https://memoryquiz.pages.dev/#south-america/list`.

## Map Data

- US state geometry comes from `us-atlas`.
- Australia map paths come from `@svg-maps/australia`, based on Lokal_Profil/Wikimedia map data under CC BY-SA 4.0.
- Continent country map paths come from `@svg-maps/world`.

## Commands

```bash
npm install
npm run dev
npm run build
```

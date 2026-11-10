# Sole Operator

An isometric 3D management game: one character, The Operator, runs a whole nuclear
power plant. It's a standalone Vite + React + TypeScript app, served at
**https://overtone.games/sole-operator/**, linked from the homepage card in
`public/Homepage/src/data/games.js`.

Design references live in [docs/design/](docs/design/): `control-room-v2.png` (in-game
camera and HUD) and `facility-map-v2.png` (pause-screen map) are the direction.
`control-room-v1.png` is an earlier mock-up, kept only as a reference for room contents.

## Run, test, build

Node 22+ (CI uses 22; Vite 8 needs ≥ 20.19).

```sh
cd public/SoleOperator
npm install
npm run dev        # http://localhost:5174/sole-operator/
npm test           # vitest (sim + core unit tests)
npm run typecheck  # tsc --noEmit (TypeScript 7)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4174/sole-operator/
```

## Deploy

Nothing to do by hand. On every push to `main`, `.github/workflows/deploy.yml` builds the
homepage, then runs `npm ci && npm test && npm run build` here and copies `dist/` to
`public/Homepage/dist/sole-operator/` before uploading the site to GitHub Pages. A failing
test blocks the deploy.

`base` in `vite.config.ts` is `/sole-operator/`. If the URL ever changes, change it there,
in the CI copy step and in the homepage card's `href`.

## Folder structure

_Filled in as the foundation milestones land; see the full guide below once milestone 9 is done._

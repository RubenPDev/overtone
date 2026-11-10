# Sole Operator

An isometric 3D management game: one character, The Operator, runs a whole nuclear power plant.
It's a standalone Vite + React + TypeScript app served at **https://overtone.games/sole-operator/**,
linked from the homepage card in `public/Homepage/src/data/games.js`.

Design references live in [docs/design/](docs/design/): `control-room-v2.png` (in-game camera and
HUD) and `facility-map-v2.png` (pause-screen map) set the direction. `control-room-v1.png` is an
earlier mock-up, kept only as a reference for room contents.

## Run, test, build

Use Node 22 or newer. CI uses 22, and Vite 8 needs at least 20.19.

```sh
cd public/SoleOperator
npm install
npm run dev        # http://localhost:5174/sole-operator/
npm test           # vitest: sim, core, world and objective tests
npm run typecheck  # tsc --noEmit (TypeScript 7)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4174/sole-operator/
npm run format     # prettier
```

Dev-only shortcuts:

- `http://localhost:5174/sole-operator/?play` skips the title and starts a new game.
- `?play=fuel-storage` does the same and then teleports to that room.
- Press <kbd>`</kbd> in game for the dev overlay: FPS and ticks, teleport, speed and single step,
  rod and coolant sliders, fault injection, scram, test toast, "complete step", and a bus event log.
- In the browser console, `__soleOperator` exposes `player`, `simHost`, `objectives` and `bus`.

None of these ship: they sit behind `import.meta.env.DEV` and are removed from production builds.

### Controls

| Key | Action |
| --- | --- |
| Click floor / WASD | Move (WASD is screen-relative), Shift to sprint (uses stamina) |
| E | Interact with what the prompt shows |
| M | Facility map (pauses) |
| Esc | Pause menu |
| 1 / 2 / 3, P or Space | Game speed 1×/2×/3×, pause toggle |
| Scroll | Zoom (clamped) |
| Q / R / F | Inspect / Refuel / Rods tools (placeholders) |

## Deploy

Nothing to do by hand. On every push to `main`, `.github/workflows/deploy.yml`:

1. builds the homepage;
2. runs `npm ci && npm test && npm run build` in this folder;
3. copies `dist/` to `public/Homepage/dist/sole-operator/`;
4. uploads the site to GitHub Pages.

A failing test blocks the deploy. `base` in `vite.config.ts` is `/sole-operator/`. If the URL ever
changes, update it there, in the CI copy step and in the homepage card's `href`.

Bundle: the title screen loads only React (about 85 KB gzipped). three.js, R3F and postprocessing
(about 310 KB gzipped) download behind the loading screen, and each room's contents is its own
small lazy chunk.

## Architecture

```
src/
  sim/        Pure TypeScript plant simulation. No React, Three, DOM, Date.now or Math.random
              (enforced by sim/architecture.test.ts). Fixed tick, seeded RNG, snapshot/restore.
    plant.ts      createPlantSim(): the PlantSim implementation and the SYSTEMS pipeline
    systems/      one file per system: rods, reactivity, kinetics, fuel, thermal, turbine, alarms
    types.ts      PlantState, PlantCommand, SimEvent, PlantSim (the swap-for-WASM boundary)
  core/       Engine glue, no React: fixed-step clock, typed event bus, SimHost, save/load
  world/      Room/space types, facility graph and routing, collision, Navigator seam
  rooms/      One folder per room + registry.ts
  objectives/ Data-defined objectives and the bus-driven ObjectiveRunner
  game/       Runtime singletons, session (new/continue/save), world controller
              (corridors and transitions), interactions, input and hotkeys
  scene/      React Three Fiber: canvas, iso camera, lighting, post FX, room shell,
              corridor view, player, NPC placeholder, SimDriver
  state/      zustand stores React reads: app (screens, settings), world, hud
  hud/        The in-game overlay (compass, minimap, vitals…), styled in hud.css
  app/        Screens: loading, title, settings, pause, facility map, game view
  dev/        Dev overlay (dev builds only)
  styles/     Design tokens (tokens.css) and the 3D palette (palette.ts)
```

### The rules this code follows

1. **The simulation is pure and deterministic.** `SimHost` (core) is the only caller of
   `sim.step()`. It runs 10 ticks per real second at 1× through a fixed-step accumulator. Speed
   (0/1/2/3×) changes how many ticks run, never the tick length, so 3× gives exactly the same
   results as 1×. One tick is 6 game seconds, so 1 real second at 1× is 1 game minute
   (`GAME_SECONDS_PER_TICK`). Commands are queued and applied at the start of the next tick. A
   Rust/WASM sim only has to implement `PlantSim`.
2. **React never re-renders per frame.** Movement, animation, rods and glow update in `useFrame`
   from refs and plain objects (`game/runtime.ts`, `scene/stage.ts`). `scene/SimDriver.tsx` is the
   only bridge into React: it publishes plant data at 5 Hz and player data at 10 Hz into
   `state/hud.ts`. HUD widgets subscribe to narrow selectors.
3. **Rooms are data.** A `RoomDefinition` (world/types.ts) declares bounds, doorways and their
   corridors, spawn, interactables, workstations, obstacles and a lazy `load()` for its 3D
   contents. The generic `RoomShell` builds floor, cutaway walls, doors and corridor stubs from
   that data. `world/facility.ts` holds the whole plant: 7 rooms, a junction and 7 corridors. It
   drives compass distances, the minimap, the map screen and routing.
4. **Only one space is mounted:** the current room plus its corridor stubs, or the corridor being
   walked. Walking into an open door's stub fades out, mounts the corridor and starts loading the
   next room's code. Reaching the far end fades into that room. Doors to rooms that aren't built
   yet show a "sealed" shutter; the accelerator is "locked" by clearance.
5. **One bus** (`core/events.ts`, typed by `GameEvents`) connects everything. `cmd/*` channels are
   requests (`cmd/sim` reaches the plant); the rest are facts (`sim`, `interact`, `item/picked`,
   `room/entered`…). Objectives, toasts, autosave and the dev log all listen there.
6. **Saves** are versioned JSON in `localStorage` (`sole-operator:save:auto|manual`). There's an
   autosave every 2 minutes and on entering a room, plus a manual save from the pause menu. When
   the shape changes, bump `SAVE_VERSION` and add `MIGRATIONS[oldVersion]` in `core/save.ts`.
7. **Quality:** High gives bloom, PCF shadows, 4× MSAA and DPR up to 2. Low turns those off and
   keeps the grade. Touch devices with small screens start on Low.

## How to add a new room

Example: the Steam Turbine Hall. Its node (`turbine-hall`) and corridor (`C-2`) already exist in
`world/facility.ts`.

1. **Create `src/rooms/turbine-hall/index.ts`** exporting a `RoomDefinition`:
   - `id: 'turbine-hall'` (must match the facility node), plus `name`, `level`, `bounds`
     (room-local metres, origin at the floor centre) and `wallHeight`.
   - `doorways`: one per corridor touching the room, e.g.
     `{ id: 'control', facing: '+x', width: 4, corridor: 'C-2', sign: 'REACTOR CONTROL' }`.
     Pick `facing` so the door points the way the corridor runs on the map: +x is screen
     down-right, -x up-left, +z down-left, -z up-right. -x/-z walls are full height; +x/+z walls
     are cut low.
   - `spawn`, `interactables` (each with an `action`, see below), `workstations` (for future
     NPCs) and `obstacles` (circles/rects for collision).
   - `load: () => import('./Contents')`.
2. **Create `src/rooms/turbine-hall/Contents.tsx`.** Its default export renders the room's props,
   accent lights and `GlowDecal` light pools. Keep real point lights to a handful; use decals for
   the rest. Read live sim data in `useFrame` via `simHost.state`, not React state.
3. **Register it** by adding it to the `ALL` list in `src/rooms/registry.ts`.

That's it. The door in the Control Room switches from "sealed" to open automatically, the
corridor becomes walkable, and the compass, minimap and map screen pick the room up.
`world/world.test.ts` checks that every doorway's corridor touches its room, and that spawns and
interactables are on walkable floor. Run `npm test`.

New interaction types go in the `InteractAction` union (world/types.ts) and the switch in
`game/interactions.ts`. A brand-new room (not one of the 7) also needs a node and corridor in
`world/facility.ts`.

## How to add a new sim system

Example: a xenon poisoning system.

1. Add any new state fields to `PlantState` in `sim/types.ts`, and their initial values in
   `createInitialState()` (`sim/plant.ts`). Put tunable numbers in `sim/constants.ts`, in game
   seconds.
2. Create `sim/systems/xenon.ts` exporting a `SimSystem`:
   ```ts
   export const xenonSystem: SimSystem = {
     id: 'xenon',
     step(state, ctx) {
       // read state, mutate only what this system owns; ctx.dt is game seconds,
       // ctx.rng for randomness, ctx.emit({...}) for SimEvents
     },
   };
   ```
   Use `relax()` from `sim/system.ts` for first-order lags; it's stable at any step size.
3. Insert it into `SYSTEMS` in `sim/plant.ts` at the right point in the order (e.g. before
   `reactivitySystem` if reactivity should read it).
4. If it adds player actions, extend `PlantCommand` and handle it in `applyCommand()`. If it adds
   outcomes, extend `SimEvent`. HUD fields go through `toHudSim()` in `state/hud.ts`.
5. If the change alters `PlantState`'s shape, bump `SIM_SCHEMA` and `SAVE_VERSION` and write a
   save migration that fills the new fields.
6. Add tests next to `sim/plant.test.ts`. The architecture test fails if the system imports React,
   Three or the DOM, or calls `Math.random`/`Date.now`.

## Plant model v0, in one paragraph

Reactivity (pcm) = fuel excess (falls with each cell's burn-up; an empty port is strongly
negative) − rod worth (S-curve per rod) − temperature and power feedback. Fission power changes
exponentially with reactivity over a lumped generation time, plus decay heat (6.5%, lagging) that
keeps the core warm after a scram. Core temperature lags thermal power through a lumped heat
balance (inlet temperature, coolant flow), and pressure follows temperature. Turbine output lags
thermal power at 32.9% efficiency, minus vibration losses. Each cell's share of power depends on
its own rod and burn-up, and burn-up only ever rises. Alarms are edge-triggered with hysteresis.
Nominal is about 3,700 MWt, 312 °C, 15.4 MPa and 1,218 MWe, with rods at about 36%. Moving all
rods 5% changes power by about 17%, and the response is overdamped.

## Extension points and TODOs

- **Navigation / physics:** `world/geometry.ts` has `Navigator` (straight line now) and
  `SpaceLayout` (rects + obstacles). Swap in recast-navigation-js or Rapier behind those, built
  from each room's geometry.
- **NPCs:** `RoomDefinition.workstations` holds seats and roles; `scene/Npc.tsx` is a seated
  placeholder. TODO: schedules, walking (cafeteria breaks), reacting to `sim` alarms on the bus.
- **Tools:** Q/R/F are stubs in `game/hotkeys.ts`. TODO: rod panel (the swap currently leaves the
  rod fully in for the player to withdraw), refuelling machine, inspect mode.
- **Screens:** the map's STAFF / RESEARCH / LOGBOOK tabs are disabled stubs.
- **Sim:** xenon, coolant pumps, turbine trip, cooling chambers and water reserves; move dosimetry
  (now a placeholder in `scene/Player.tsx`) into the sim.
- **Audio:** none yet; hook a sound system to the bus.
- **Art:** every room is greybox; replace room by room inside its `Contents.tsx`.

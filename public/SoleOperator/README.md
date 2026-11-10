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
npm run dev        # http://localhost:5175/sole-operator/
npm test           # vitest: sim, core, world and objective tests
npm run typecheck  # tsc --noEmit (TypeScript 7)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4174/sole-operator/
npm run format     # prettier
```

Dev-only shortcuts:

- `http://localhost:5175/sole-operator/?play` skips the title and starts a new game.
- `?play=fuel-storage` does the same and then teleports to that room.
- Press <kbd>`</kbd> in game for the dev overlay: FPS and ticks, teleport, speed and single step,
  rod and coolant sliders, fault injection, scram, test toast, "complete step", and a bus event log.
- In the browser console, `__soleOperator` exposes `player`, `simHost`, `objectives`, `bus`,
  `logistics`, the refuelling `machine` and `enterMode`/`exitMode`.

None of these ship: they sit behind `import.meta.env.DEV` and are removed from production builds.

### Controls

| Key                   | Action                                                                          |
| --------------------- | ------------------------------------------------------------------------------- |
| Click floor / WASD    | Move (WASD is screen-relative), Shift to sprint (uses stamina)                  |
| E                     | Interact with what the prompt shows (talk, use, push/park the transfer cart…)   |
| M                     | Facility map (pauses)                                                           |
| Esc                   | Leave a control mode, else pause menu                                           |
| 1 / 2 / 3, P or Space | Game speed 1×/2×/3×, pause toggle                                               |
| Scroll                | Zoom (clamped)                                                                  |
| F                     | Rod control (in Reactor Control)                                                |
| R                     | Refuelling machine (when the cart is docked in the core bay)                    |
| Q                     | Handheld scanner readout (after buying the scanner)                             |
| T                     | Ops tablet: contracts, upgrades, tools, market, clearance (plant keeps running) |

Control modes (the Operator stands still, the camera frames the machine, and a panel replaces the
hotkey bar):

| Mode               | Opened from                                                | Keys                                                                             |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Rod control        | Operator console, or F                                     | ←/→ or 1–9, 0, -, = select · hold W withdraw · hold S insert · B bank (all rods) |
| Fuel crane         | Crane console in Fuel Rod Storage                          | WASD drive the bridge crane · E lower, grab or release, raise                    |
| Refuelling machine | Refuelling machine (core panel) with the cart docked, or R | ←/→ cell · hold S rod in · hold E extract, then hold E load                      |
| RF tuning          | RF console, RF Station (ring S1)                           | ←/→ or 1–8 cavity · hold W/S sweep frequency (Shift = fine)                      |
| Production         | Target Station console (S6) or Detector control (S3)       | W/S select run · E start/stop · B beam on/off                                    |
| Ring shuttle       | Shuttle stop in any ring sector                            | W/S select sector · E ride                                                       |
| Tank service       | Any tank station or the water ops panel (Water Containers) | ←/→ tank · hold W/S open/close outlet valve · hold E weld a patch (valve closed) |

### The fuel loop

1. Inspect cell 07 at the refuelling machine (burn-up 96%).
2. In Fuel Rod Storage, use the crane to lift a fresh assembly (green top) from the pool rack into
   the cask on the transfer cart at the cask dock.
3. Push the cart (E) along corridor C-1 and park it in the cart bay next to the core (it snaps in).
4. Run the refuelling machine: rod in → extract (the spent cassette rides the glass chute down
   into the cask) → load (the fresh one rides up and the arm seats it).
5. The rod stays fully in, because fresh fuel adds reactivity. Bring power back with rod control.
6. Side objective: take the spent assembly back and crane it into the pool.

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

## The particle accelerator

A 3.4 km superconducting ring runs under the whole plant (ring level B4), in
eight 425 m tunnel segments (`R-12` … `R-81`) between eight sector chambers.
Access shafts lead down from the plant: A-1 from Fuel Rod Storage to S6, A-2
from Water Containers to S2, A-3 from the Turbine Hall to S8. Every sector has
a shuttle stop for fast travel round the ring.

| Sector     | Station                                                        |
| ---------- | -------------------------------------------------------------- |
| S1         | RF Station: 8 superconducting cavities, RF console, rail drone |
| S3         | Detector Hall: collider runs for research data                 |
| S5         | Injector Linac                                                 |
| S6         | Target Station: production runs                                |
| S7         | Beam Dump                                                      |
| S2, S4, S8 | Junctions (S2 and S8 have access shafts)                       |

**Model** (`sim/accelerator.ts`, pure TS, tested):

- Cavity tuning drifts as a random walk (about 15 kHz per game day), which lowers each cavity's field.
- Field sets beam energy (up to 1.2 GeV). Beam current falls as beam loss rises.
- Beam loss heats the cryomodules. Interlocks trip the beam above 2% loss or 4.5 K.
- Beam power (MW) = energy (GeV) × current (mA), and that power on target drives production.
- The ring draws 30–45 MWe from the plant (`netOutput`). A reactor trip starves the cryo plant and the ring trips.

**Recipes** (`RECIPES`, data only): enriched uranium, Mo-99 medical isotopes,
collider research, Pu-239 and U-233 breeding, spent-fuel transmutation,
tritium, D-T fusion fuel, helium-3 and antimatter. Each has inputs, a rate
per MWh, a minimum beam energy and a clearance tier. The player starts at L3;
higher tiers show as locked until the progression system exists.
Antimatter also needs a ring energy upgrade (1.45 GeV).

**Rooms:** `rooms/ring/index.ts` builds all eight sector chambers from one
template (`makeSector`), so stations differ only by data and a component in
`rooms/ring/Contents.tsx`. Ring corridors render as `scene/RingTunnel.tsx`.
The beamline (`scene/Beamline.tsx`) is instanced: a 425 m tunnel costs a few
dozen draw calls.

## Water Containers

`sim/water.ts` (pure TS, tested) models the demineralised water reserve: four 2,000 m³ tanks (six
with upgrades) feed plant make-up from every open outlet valve, and the RO treatment train refills
them. Tanks corrode; corrosion raises the chance of a leak, a hole at some height on the shell that
drains the tank down to that height. To repair one, close its valve (isolate it) and weld a patch.
If the online reserve drops below 20% of the base reserve, the plant's heat sink suffers, and below
30% the water-low alarm sounds. Upgrades: extra tanks, stainless or composite liners (fewer leaks),
leak sensors (leaks are reported with the tank number) and a bigger treatment train.

The room (`rooms/water-containers`) keeps the tall tanks against the back walls so they never hide
the floor. Each tank shows its level in a sight glass, a roof status lamp, and a valve wheel that turns
with the valve; leaks jet water and spread a puddle until patched.

## Progression and economy

`sim/economy.ts` (pure TS, tested) adds money and progression to the plant model:

- **Grid sales.** Net output (after the ring's draw) sells at a price that follows demand: about
  2.4 CR/MWh on average, +30% at the 18:00 peak, −30% at 06:00. A plant drawing more than it makes
  buys power back at 1.5×.
- **Market.** Accelerator products sell at fixed prices; feedstock and fresh fuel assemblies are
  bought (fuel arrives in the pool rack). Spent assemblies can be shipped to the ring stores as
  transmutation feed.
- **Upgrades and tools** (`UPGRADES`, data only) cost credits, sometimes research data, and need a
  clearance level. Systems read them with `upgradeLevel(state, id)`: rod drive speed, turbine
  efficiency, RF drift, cryo draw, beam current, ring energy, and the water upgrades. Tools
  (scanner, vibration analyzer, triple cask, shielded suit) are one-level upgrades the game layer
  checks with `hasTool`.
- **Clearance** runs L1–L8. A review costs 60·L² research data and 15,000·L credits. New games
  start at L1.
- **Contracts** come in every 3 game hours from the seeded RNG: deliveries of anything the player
  can make at their clearance, or grid dispatch requests (hold N MWe net for some hours). Active
  deliveries complete automatically once the stores hold enough.
- **Objectives** can carry a `reward` in credits.

To add a purchase: add an entry to `UPGRADES` (or `MARKET`), then read its level where it matters.
The ops tablet (`app/OpsTablet.tsx`) lists it automatically.

## Sound

Every sound is synthesized at runtime with the Web Audio API: no audio files, nothing to download.

- `audio/engine.ts`: the context (created on the first click or key press), three buses (effects,
  ambience, interface) into a compressor, and a convolution reverb generated per space (room, hall,
  big hall, corridor, tunnel). Primitives: `tone()`, `noise()` and `Bed` (a continuous loop with
  live parameters).
- `audio/sounds.ts`: the palette. Beds: mains hum, air handling, coolant pumps, pool water, helium
  compressor, klystron whine, magnet hum, motors, rod drives, cart wheels, hydraulics and the alarm
  klaxon. One-shots: footsteps by floor type, pneumatic doors, latches, relays, the scram, beam
  trips, crane chain, splashes, drips, keyboard clatter, and soft interface tones.
- `audio/director.ts`: maps the game onto sound. Each space has a mix (`SPACE_MIX`): beds, levels,
  reverb, floor type and random texture sounds. Machines follow live state each frame (rods moving,
  crane, cart, refuelling machine, drone, unacknowledged alarms). Bus events trigger one-shots.

Design rules: industrial and believable first; interface sounds are soft sine and triangle tones;
the klaxon is the only harsh sound, and acknowledging the alarm at the alarm panel silences it.
Volumes (master, effects, ambience) are in Settings.

### How to add sound for a new room

1. Add a mix to `SPACE_MIX` in `audio/director.ts`, keyed by room id: acoustics, floor surface,
   bed levels and an optional texture one-shot.
2. New beds go in `audio/sounds.ts` and are registered in `BED_FACTORIES`.
3. Machines with live state: drive a `Bed` from `updateAudio()` (or the room's own `useFrame`),
   positioned with `placeAt({ x, z })`.

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
  logistics/  Pure TS fuel logistics: pool rack, crane hook, transfer-cart cask (tested)
  objectives/ Data-defined objectives (with chaining) and the bus-driven ObjectiveRunner
  game/       Runtime singletons, session (new/continue/save), world controller
              (corridors and transitions), interactions, input and hotkeys,
              control modes (modes.ts), crane, refuelling machine, transfer cart
  scene/      React Three Fiber: canvas, iso camera, lighting (+ procedural environment map),
              post FX, room shell (floor holes, auto doors), corridor view, player, NPCs
              (seated/standing/walking), transfer cart, shared props (props.tsx),
              SimDriver and ModeDriver (the per-frame loops)
  state/      zustand stores React reads: app, world, hud, mode, logistics
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
   requests (`cmd/sim` reaches the plant); the rest are facts (`sim`, `interact`, `fuel/craned`,
   `cart/docked`, `room/entered`, `plant/sample`…). Objectives, toasts, autosave and the dev log all listen there.
6. **Saves** are versioned JSON in `localStorage` (`sole-operator:save:auto|manual`). There's an
   autosave every 2 minutes and on entering a room, plus a manual save from the pause menu. When
   the shape changes, bump `SAVE_VERSION` and add `MIGRATIONS[oldVersion]` in `core/save.ts`.
   Saves are at v4. v2 added fuel logistics (the v1 → v2 migration puts a carried assembly into the
   cart's cask). v3 added the accelerator (sim schema 2; the v2 → v3 migration commissions a fresh ring).
   v4 added the economy (sim schema 3; old saves get the opening balance and keep their clearance).
7. **Quality:** High gives bloom, PCF shadows (refreshed at half rate), SMAA and DPR up to 1.5; an adaptive governor lowers resolution when frames run long. Low turns those off and
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

### Interactables and props

- **New interactable:** add it to the room definition's `interactables` with an `action`. For a new
  kind of action, extend `InteractAction` in world/types.ts and handle it in `game/interactions.ts`.
  Every press is also announced on the bus as `interact`, so objectives can react without code.
- **Environment props** (vending machine, water cooler, extinguisher, first aid, wall clock, alarm
  beacon, security camera, pipes, terminals, eyewash) are in `scene/props.tsx`. Wall-mounted props
  take a `yaw` that points their front into the room (0 on a -z wall, π/2 on a -x wall). Put them
  against the back walls: the camera only sees the backs of things against the low front walls.
- **Pits and pools:** list them in `floorHoles`. The shell cuts them out of the floor and slab, and
  the room's Contents draws what's below.

## How to add a control mode

1. Add the mode to the `Mode` union in `state/mode.ts` (plus any panel readout state).
2. Put its logic in `game/<mode>.ts` as plain mutable state and an update function.
3. Call it from `scene/ModeDriver.tsx` (held keys) and `installModeKeys` in `game/modes.ts`
   (one-shot keys). Check `modeInput.armed` so the E that opened the mode doesn't also act in it.
4. Give the room a camera framing in `RoomDefinition.focus`, and add a panel to `hud/ModePanel.tsx`.
5. Open it from an interactable with `enterMode`. Esc already leaves any mode.

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
- **Tools:** the scanner's readings per room live in `hud/Scanner.tsx` (`scanReadings`).
- **Fuel:** assembly ids and burn-up flow between the sim (cells) and logistics (pool, cask). TODO:
  a cooling timer for spent fuel in the pool, crane collisions.
- **Screens:** the map's STAFF / RESEARCH / LOGBOOK tabs are disabled stubs.
- **Sim:** xenon, coolant pumps, turbine trip, cooling chambers and water reserves; move dosimetry
  (now a placeholder in `scene/Player.tsx`) into the sim.
- **Audio:** spoken PA announcements and positional 3D audio (Web Audio panners) are open.
- **Art:** every room is greybox; replace room by room inside its `Contents.tsx`.

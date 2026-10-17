# Night Shift Heist

A top-down stealth game where the guards are the point: they patrol a loop,
notice you through a range/cone/line-of-sight check, chase you along an A\*
path, lose you, search the last place they saw you, and walk back to their
post. Built with Phaser 3 and Vite in plain JavaScript, with every AI system
written from scratch and unit tested.

> Status: Phase 4 (the MVP) - tagged `v0.1-mvp`. Guards patrol the level,
> notice the player, chase along an A\* path and go back to their post; you can
> walk, sprint and sneak around them. Line of sight, search behaviour, the
> objective and the alarm come next.

## Prerequisites

- Node.js 20 or newer (developed on Node 24)
- npm 10 or newer
- A modern browser with WebGL or Canvas 2D

## Installation

```bash
npm ci        # or `npm install` for a fresh checkout
```

## Execution

```bash
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # production bundle in dist/
npm run preview   # serve the built bundle
```

## Testing

```bash
npm test          # Vitest, once
npm run test:watch
npm run lint      # ESLint
```

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| `Shift` | Sprint (drains stamina) |
| `Ctrl` | Sneak (silent) |
| `F1` | Toggle the debug overlay |
| `R` | Restart the level |

## How the AI works

Every guard runs the same loop, and each stage is a separate testable module:

```
Perception  ->  FSM  ->  Pathfinder  ->  PathFollower  ->  Enemy
(what can it   (what    (where does    (which way now?)  (position +
 see?)          now?)    it go?)                          visuals)
```

The guard owns its own position and integrates its own movement, so a test can
step a whole patrol headlessly and assert on the exact state sequence. Nothing
in `src/ai` or `src/world` imports Phaser.

`F1` draws what the guard believes: the vision cone and its range, the arrival
radius, the A\* route it is walking and every patrol waypoint with its order.

## What works today

- Two guards patrol the shared waypoint loop, pausing and scanning at each post.
- They see the player by range and field of view, chase along an A\* route and
  return to the post they abandoned when they lose you.
- The player walks, sprints on a stamina bar and sneaks silently.
- `R` restarts the level; `F1` toggles the debug overlay.

Known gaps, in the order they are planned:

- **No line of sight yet.** A guard can see through a wall if you are inside its
  cone and range.
- **No suspicion, no search.** Losing sight sends a guard straight home, so a
  guard that keeps glimpsing you flickers between chase and return instead of
  investigating.
- The chips and the exit are drawn but not collectable, and nothing happens yet
  when a guard reaches you.

## Architecture

```
src/
  ai/        pure logic: StateMachine, states, Perception,
             Pathfinder, PathFollower, PriorityQueue   (no Phaser import)
  world/     pure logic: Grid, LevelData, geometry     (no Phaser import)
  entities/  thin Phaser wrappers: Player, Enemy
  scenes/    Boot, Game
  utils/     Timer, Stamina
tests/       Vitest suites for the pure modules
```

## External libraries and assets

- **Phaser 3.90.0** - rendering, input, scene lifecycle, the player's collision.
  Pinned exactly, not a floating range.
- **Vite** - dev server and bundler.
- **Vitest**, **ESLint**, **Prettier** - development only.

No pathfinding or AI library is used. No texture or audio files ship with the
game: textures are generated in code at boot, and sounds are synthesised with
the WebAudio API instead of being loaded as assets.

## Credits

MIT licensed. See [LICENSE](LICENSE).

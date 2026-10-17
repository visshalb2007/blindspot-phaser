# Night Shift Heist

A top-down stealth game where the guards are the point: they patrol a loop,
notice you through a range/cone/line-of-sight check, chase you along an A\*
path, lose you, search the last place they saw you, and walk back to their
post. Built with Phaser 3 and Vite in plain JavaScript, with every AI system
written from scratch and unit tested.

> Status: Phases 0-6. Guards patrol, check range, cone *and* a clear line before
> they believe their eyes, chase along an A\* route and go back to their post.
> Suspicion, search and the objective come next.

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
npm run bench     # AI performance against a frame budget
```

## Performance

`npm run bench` measures the hand-written AI on the shipped level: one A\* search,
one line-of-sight ray, and a whole simulated frame of guards patrolling and
chasing. It prints a table and exits non-zero if a budget is missed. A typical
run on a desktop (Node 24, 2 guards):

| Metric | Measured | Budget |
| --- | --- | --- |
| A\* median search | 0.027 ms | 0.5 ms |
| A\* worst search | 0.19 ms | 5 ms |
| Cells expanded per search | 56 of 450 | - |
| Line of sight, per ray | 0.09 us | 20 us |
| Whole AI frame, mean | 0.002 ms | 1 ms |
| Whole AI frame, worst | 0.21 ms | 5 ms |

At 60 Hz a frame is 16.7 ms, and a search costs about 0.2% of one, so there is
roughly three orders of magnitude of headroom before the AI is what limits the
frame. That is why the pathfinder is left allocating its maps per call rather
than being rewritten around reusable buffers: the measurement says the
allocation is not worth the complexity, and `tests/Pathfinder.test.js` keeps the
expansion count honest so a heuristic regression shows up as a test failure
rather than a stutter.

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
(range, cone,   (what    (where does    (which way now?)  (position +
 clear line)     now?)    it go?)                          visuals)
```

`Perception` only reports a sighting when all three of its tests agree: close
enough, inside the guard's field of view, and a clear line across the grid. That
last one is `world/LineOfSight.js`, a Bresenham raycast that also reports which
wall cut the view.

The guard owns its own position and integrates its own movement, so a test can
step a whole patrol headlessly and assert on the exact state sequence. Nothing
in `src/ai` or `src/world` imports Phaser.

`F1` draws what the guard believes: the vision cone and its range, the sight ray
this frame (green clear, red with a cross where a wall cuts it), the arrival
radius, the A\* route it is walking and every patrol waypoint with its order.

## What works today

- Two guards patrol the shared waypoint loop, pausing and scanning at each post.
- They see the player by range, field of view **and** a clear line of sight, so
  walls and corners hide you. They chase along an A\* route and return to the
  post they abandoned when they lose you.
- The player walks, sprints on a stamina bar and sneaks silently.
- `R` restarts the level; `F1` toggles the debug overlay.

Known gaps, in the order they are planned:

- **No suspicion, no search.** Losing sight sends a guard straight home, so a
  guard that keeps glimpsing you flickers between chase and return instead of
  investigating, and a guard has no memory of where you went.
- **Nothing is heard yet.** The player already computes a noise radius for
  sneaking, walking and sprinting; no guard listens to it.
- The chips and the exit are drawn but not collectable, and nothing happens yet
  when a guard reaches you.

## Architecture

```
src/
  ai/        pure logic: StateMachine, states, Perception,
             Pathfinder, PathFollower, PriorityQueue   (no Phaser import)
  world/     pure logic: Grid, LevelData, LineOfSight, geometry
                                                      (no Phaser import)
  entities/  thin Phaser wrappers: Player, Enemy
  scenes/    Boot, Game
  utils/     Timer, Stamina
tests/       Vitest suites for the pure modules
scripts/     bench.js, the AI performance benchmark
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

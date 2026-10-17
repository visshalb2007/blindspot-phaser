# Night Shift Heist

A top-down stealth game where the guards are the point: they patrol a loop,
notice you through a range/cone/line-of-sight check, take a moment to be sure,
chase you along an A\* path, lose you, search the last place they saw you, and
walk back to their post. Built with Phaser 3 and Vite in plain JavaScript, with
every AI system written from scratch and unit tested.

> Status: Phases 0-7. Guards patrol, check range, cone *and* a clear line before
> they believe their eyes, and a sighting only commits them once a certainty
> meter fills: they glance, they look closer, they hunt, they search where they
> last saw you, then they go back to their post. A landed blow costs the player
> a point of health. The objective comes next.

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

`npm run bench` measures the hand-written AI on the shipped level: one A\*
search, one line-of-sight ray, and a whole simulated frame of guards patrolling,
chasing and searching. The stand-in player walks the guards' route against them
and stops every couple of seconds to look around, which is what keeps it in a
cone long enough to actually be hunted - a player who only ever walks crosses a
cone at the difference of the two speeds and is gone before any guard works up
past suspicion. A typical run on a desktop (Node 24, 2 guards, chases on 13% of
frames):

| Metric | Measured | Budget |
| --- | --- | --- |
| A\* median search | 0.028 ms | 0.5 ms |
| A\* worst search | 0.16 ms | 5 ms |
| Cells expanded per search | 56 of 450 | - |
| Line of sight, per ray | 0.09 us | 20 us |
| Whole AI frame, mean | 0.003 ms | 1 ms |
| Whole AI frame, worst | 0.27 ms | 5 ms |

At 60 Hz a frame is 16.7 ms, and the worst AI frame measured is about 1.5% of
one, so there is roughly three orders of magnitude of headroom before the AI is
what limits the frame. That is why the pathfinder is left allocating its maps
per call rather than being rewritten around reusable buffers: the measurement
says the allocation is not worth the complexity, and `tests/Pathfinder.test.js`
keeps the expansion count honest so a heuristic regression shows up as a test
failure rather than a stutter.

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
Perception -> Alertness -> FSM -> Pathfinder -> PathFollower -> Enemy
(range,       (how sure    (what  (where does    (which way     (position +
 cone,         are we?)      now?)  it go?)        now?)          visuals)
 clear line)
```

`Perception` only reports a sighting when all three of its tests agree: close
enough, inside the guard's field of view, and a clear line across the grid. That
last one is `world/LineOfSight.js`, a Bresenham raycast that also reports which
wall cut the view.

A sighting does not send a guard straight at you. It feeds a certainty meter
that fills while the guard can see you and drains while it cannot, and the meter
decides how far the guard commits:

| Meter | State | What the guard does |
| --- | --- | --- |
| filling | `SUSPICIOUS` | Stops for a beat, then creeps toward you at patrol speed |
| full | `CHASE` | Runs an A\* route to you, or to where it last saw you |
| - | `ATTACK` | Swings once it is within arm's reach |
| - | `SEARCH` | Walks to the last place it saw you and sweeps in place |
| draining | `RETURN` | Walks back to the post it left, then resumes patrol |

The two rates are deliberately asymmetric: the meter fills in about 1.7 seconds
of unbroken sight, but takes 2.8 seconds to drain back below the suspicion
threshold. That gap is what stops the state strobing that a single sighting test
would otherwise produce, and it means that breaking the line of sight for a
moment does not end a hunt. A guard that has committed stays committed for a
second without seeing you before it gives up, and once it is swinging it sees
the swing through.

The guard owns its own position and integrates its own movement, so a test can
step a whole patrol headlessly and assert on the exact state sequence. Nothing
in `src/ai` or `src/world` imports Phaser, and the brain reports a landed blow
through an injected `onHit` callback rather than reaching into the scene.

`F1` draws what the guard believes: the vision cone and its range, the sight ray
this frame (green clear, red with a cross where a wall cuts it), the arrival
radius, the A\* route it is walking and every patrol waypoint with its order.

## What works today

- Two guards patrol the shared waypoint loop, pausing and scanning at each post.
- They see the player by range, field of view **and** a clear line of sight, so
  walls and corners hide you, and their certainty builds over time instead of
  switching on the first hint of a sighting.
- They creep toward a player they are unsure about, chase along an A\* route,
  search where they last saw you, and return to the post they abandoned.
- They swing when they get close enough. A hit costs a point of health and
  leaves a short window of blinking invulnerability, so two guards swinging on
  the same frame cannot cost two points between them. Three hits and you are
  caught: the level stops until `R`.
- The player walks, sprints on a stamina bar and sneaks silently.
- A HUD shows health and each guard's certainty, which is otherwise invisible.
- `F1` toggles the debug overlay on top of the A\* route and vision cone.

Known gaps, in the order they are planned:

- **Nothing is heard yet.** The player already computes a noise radius for
  sneaking, walking and sprinting; no guard listens to it.
- The chips and the exit are drawn but not collectable, so there is no way to
  win. Being caught and pressing `R` is the whole of the game loop so far.
- A guard that searches always runs its full time budget in one spot, rather
  than widening the sweep around the last known position.
- Routes land on tile centres, which is right for a patrol post and wrong for a
  person. A guard that is *looking* at the player now walks straight at them
  rather than at the middle of their tile, so it closes the gap exactly - but a
  guard that is only walking to a remembered position can stop up to half a tile
  from it. Worth knowing when reading the AI tests, which assert on whole tiles
  for that reason.

## Architecture

```
src/
  ai/        pure logic: StateMachine, states, Perception, Alertness,
             Pathfinder, PathFollower, PriorityQueue    (no Phaser import)
  world/     pure logic: Grid, LevelData, LineOfSight, geometry
                                                       (no Phaser import)
  entities/  thin Phaser wrappers: Player, Enemy
  scenes/    thin Phaser wrappers: Boot, Game
  utils/     pure logic: Timer, Stamina, Health
tests/       Vitest suites for the pure modules
scripts/     bench.js, the AI performance benchmark
```

The dividing line is deliberate: anything that decides *what* happens is pure
JavaScript that a test can step frame by frame with no renderer, and anything
that draws or moves a sprite is a thin wrapper that calls into it.

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

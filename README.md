# Night Shift Heist

<img width="1263" height="906" alt="image" src="https://github.com/user-attachments/assets/66b80b81-38bd-4e12-b472-3124c1ddc081" />

A top-down stealth game where the guards are the point. They patrol a loop, notice
you through a range / cone / line-of-sight check, hear you through the wall you
are hiding behind, take a moment to be sure, chase you along an A\* path, lose
you, search the last place they saw or heard you, and walk back to their post.
Lift every data chip, reach the door, and do not get caught.

Built with Phaser 3 and Vite in plain JavaScript. Every AI system is written from
scratch - no pathfinding or behaviour library - and every decision a guard makes
belongs to a pure module with its own tests.

- **Five levels** of rising difficulty, chosen from a start page that shows the
  level you are about to play patrolling behind it.
- **Guards that commit gradually.** A certainty meter fills while they can see or
  hear you, so a glimpse is a look and noise alone can never start a chase.
- **A run you can measure.** Every run is timed, and the start page keeps your
  record between sessions.

> **Status: Phases 0-11.** Playable end to end and verified in a browser: five
> levels, a start page, guards that patrol, notice, search and chase, and a record
> of your runs. 335 unit tests across 22 files, all AI performance budgets met.
> Where it is still thin is listed in [Status and roadmap](#status-and-roadmap).

## Contents

- [Getting started](#getting-started)
- [Controls](#controls)
- [A run](#a-run)
- [The five levels](#the-five-levels)
- [The start page](#the-start-page)
- [How the AI works](#how-the-ai-works)
- [Architecture](#architecture)
- [Performance](#performance)
- [Status and roadmap](#status-and-roadmap)
- [Dependencies](#dependencies)
- [Credits](#credits)

## Getting started

Node.js 20 or newer (developed on 24), npm 10 or newer, and a modern browser with
WebGL or Canvas 2D.

| Command | What it does |
| --- | --- |
| `npm ci` | Install (`npm install` on a fresh checkout) |
| `npm run dev` | Vite dev server on <http://localhost:5173> |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Serve the built bundle |
| `npm test` | The unit tests, once |
| `npm run test:watch` | The unit tests, watching |
| `npm run lint` | ESLint |
| `npm run bench` | The AI, against a frame budget |

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` / arrows | Move |
| `Shift` | Sprint (fast, loud, drains stamina) |
| `Ctrl` | Sneak (silent, slow) |
| `F1` | Toggle the debug overlay |
| `R` | Restart the level |
| `Esc` | Leave the run and go back to the start page |

On the start page, `Space` / `Enter` / a click starts a run on the level on the
board, `1`-`5` picks a level outright, and `Left` / `Right` walk the ladder.

## A run

Get every chip, then leave through the door.

- A chip is taken by walking within 18px of it. It pops and fades so it is clear
  which one went, and the HUD keeps the count.
- The door is drawn as a faint outline while chips are outstanding - walking into
  it does nothing at all, and does not bank a win for later - and brightens with a
  pulse when the last chip turns it on.
- Getting caught is the other full stop. Both ends of a run hold the world still
  and wait for `R`, and both of them are written to the record.
- Runs are timed. The clock is on the HUD line and stops with the run, so the time
  on the banner is the time the run took, and only an escape can set a best time.
  `R` counts as a new run rather than a continuation, which is what makes the
  record read as a history.

The whole win condition lives in `src/world/Mission.js`, which has no Phaser
import. `tests/Mission.test.js` asserts that the shipped level can be finished and
`tests/Levels.test.js` asserts it of all five, so a map edit that walls off a chip
or the door fails a test rather than making the game quietly impossible.

## The five levels

Five maps in the order they get harder. The ladder is on the start page: pick a
number and the briefing, the roster and the level patrolling behind the page all
follow the selection.

| # | Level | Guards | Chips | Posts | What makes it hard |
| --- | --- | --- | --- | --- | --- |
| 1 | Night Shift | 2 | 2 | 4 | Small rooms and short sightlines: somewhere to break a view every few steps. |
| 2 | Loading Bay | 3 | 3 | 6 | One open hall with pillars: nothing to hide behind between them. |
| 3 | Cold Storage | 3 | 3 | 5 | Six straight aisles with no side doors: a guard at one end sees all of it. |
| 4 | Server Floor | 4 | 4 | 6 | Three long lanes joined by two doorways each: crossing one is a commitment. |
| 5 | The Vault | 5 | 4 | 8 | Wide open, five guards, four chips, four pillars and nowhere to go. |

Difficulty here is geometry, not a hidden multiplier. There is no "hard mode"
number in the AI: the later levels are harder because they are more open (long
sightlines and no place to break one), bigger (more ground to cover, more time in
the open), tighter (one-wide aisles you cannot dodge in) and busier (more guards
walking a longer loop). The map is the strongest difficulty knob a stealth game
has, and `src/world/Levels.js` is where the ladder is written down.

Level 1 is the map every earlier phase was built and tuned against, and it is left
exactly as it was - same rows, same two guards - so all the tests and behaviour
written before there was a ladder still describe the level they always did.
`tests/Levels.test.js` holds all five to what a level has to be: the size the game
draws, no parser warnings, a spawn, a door and chips, every chip and the door
reachable on foot from the spawn, and a patrol loop the guards can walk.

## The start page

The game opens on a dashboard rather than in a run. Five panels say what the job
is, which keys do it, who is on shift, how they think, and what you have done so
far.

The numbers on it are the real ones, and that is the whole point of it being a
module rather than a wall of text calls. The chip count is read off the level, the
roster comes from the same rule `GameScene` spawns its guards from, the sight range
and the certainty thresholds are quoted from the config the guards actually run
on, and the record is what you have actually done. Retune a guard and the page
describes the new one - `tests/Briefing.test.js` asserts exactly that, because a
dashboard that quietly lies is worse than no dashboard.

The level behind it is live: the same `Game` scene in a *shadow* mode, where the
walls, the chips, the door and the guards are all there and the guards walk their
loop, with no player in the level, no HUD, no input and no way for anything to be
caught. They are handed a target nobody is standing at, so they patrol with
nothing to find - which is the honest way to show a level nobody has started, and
makes the backdrop a smoke test: if the AI stops working, the start page stops
moving. It is the same scene and the same level data as the run that follows, so
a backdrop that disagrees with the game is not a state that can be reached.

Your record is kept in `localStorage` under one versioned key by
`world/RunStats.js`, which is handed its storage rather than reaching for the
browser itself. It counts runs begun, escapes, captures, chips lifted and your
best time, and survives a reload. Every read of it is treated as hostile - the
value came off a disk, possibly written by an older build, possibly hand-edited -
so a corrupt scoreboard starts over rather than stopping the game from opening.

## How the AI works

Every guard runs the same loop, and each stage is a separate testable module:

```
Perception -> Alertness -> FSM -> Pathfinder -> PathFollower -> Enemy
(range,       (how sure    (what  (where does    (which way     (position +
 cone,         are we?)      now?)  it go?)        now?)          visuals)
 clear line)
Hearing -----^
(how far a noise carries, and what is in between)
```

`Perception` only reports a sighting when all three of its tests agree: close
enough, inside the guard's field of view, and a clear line across the grid. That
last one is `world/LineOfSight.js`, a Bresenham raycast that also reports which
wall cut the view.

`Hearing` is the second sense, and it is deliberately the weaker one. The player
carries a noise circle - nothing while sneaking or standing still, a small radius
while walking, most of a room while sprinting - and a guard standing inside it
fills the same certainty meter, faster the closer it is to the source. Walls
muffle rather than block, so a racket around a corner still lands at a fraction of
its volume: that is how a guard notices what it has no way to look at. What a
noise can never do is make a guard *certain*, because a chase is only ever entered
on a sighting and the meter's alarm reading is only consulted next to one. A loud
approach buys you an investigation, not a footrace.

A noise also leaves the guard with a *hunch*: a place worth walking to that it has
not been to yet. So when the doubt drains away with a hunch still pending, the
guard goes to search it instead of going home - walk too loudly past a patrol and
it will end up standing where you were when you stopped.

Neither sense sends a guard straight at you. Both feed one certainty meter that
fills while the guard can see or hear you and drains while it can neither, and the
meter decides how far the guard commits:

| Meter | State | What the guard does |
| --- | --- | --- |
| filling | `SUSPICIOUS` | Stops for a beat, then creeps toward you at patrol speed |
| full | `CHASE` | Runs an A\* route to you, or to where it last saw you |
| - | `ATTACK` | Swings once it is within arm's reach |
| - | `SEARCH` | Walks to the last place it saw *or heard* you and sweeps in place |
| draining | `RETURN` | Walks back to the post it left, then resumes patrol |

The two rates are deliberately asymmetric: the meter fills in about 1.7 seconds of
unbroken sight, but takes 2.8 seconds to drain back below the suspicion threshold.
That gap is what stops the state strobing that a single sighting test would
otherwise produce, and it means that breaking the line of sight for a moment does
not end a hunt. A guard that has committed stays committed for a second without
seeing you before it gives up, and once it is swinging it sees the swing through.

The guard owns its own position and integrates its own movement, so a test can
step a whole patrol headlessly and assert on the exact state sequence. Nothing in
`src/ai` or `src/world` imports Phaser, and the brain reports a landed blow
through an injected `onHit` callback rather than reaching into the scene.

`F1` draws what the guard believes: the vision cone and its range, the sight ray
this frame (green clear, red with a cross where a wall cuts it), the arrival
radius, the A\* route it is walking and every patrol waypoint with its order. It
also draws the circle the guards are listening to - the player's noise radius as
the game actually computes it, which is not there at all while sneaking.

## Architecture

```
src/
  ai/        pure logic: StateMachine, states, Perception, Hearing,
             Alertness, Pathfinder, PathFollower, PriorityQueue
                                                       (no Phaser import)
  world/     pure logic: Grid, LevelData, Levels, LineOfSight, Mission,
             Roster, RunStats, Briefing, geometry        (no Phaser import)
  entities/  thin Phaser wrappers: Player, Enemy
  scenes/    thin Phaser wrappers: Boot, Dashboard, Game
  utils/     pure logic: Timer, Clock, Stamina, Health
tests/       Vitest suites for the pure modules
scripts/     bench.js, the AI performance benchmark
```

The dividing line is deliberate: anything that decides *what* happens is pure
JavaScript that a test can step frame by frame with no renderer, and anything that
draws or moves a sprite is a thin wrapper that calls into it. That is why a guard's
colour, icon and state text are all derived from one place - what you see on
screen cannot disagree with what the AI is doing.

## Performance

`npm run bench` measures the hand-written AI: one A\* search, one line-of-sight
ray, and a whole simulated frame of guards patrolling, chasing and searching. The
stand-in player walks the guards' route against them and stops every couple of
seconds to look around, which is what keeps it in a cone long enough to actually
be hunted - a player who only ever walks crosses a cone at the difference of the
two speeds and is gone before any guard works up past suspicion.

A typical run on a desktop (Node 24, two guards, chases on 13% of frames):

| Metric | Measured | Budget |
| --- | --- | --- |
| A\* median search | 0.028 ms | 0.5 ms |
| A\* 95th percentile | 0.090 ms | 2 ms |
| A\* worst search | 0.16 ms | 5 ms |
| Cells expanded per search | 56 of 450 | - |
| Line of sight, per ray | 0.09 us | 20 us |
| Whole AI frame, mean | 0.003 ms | 1 ms |
| Whole AI frame, 95th percentile | 0.005 ms | 5 ms |
| Whole AI frame, worst | 0.23 ms | 5 ms |

At 60 Hz a frame is 16.7 ms and the worst AI frame measured is about 1.5% of one,
so there are roughly three orders of magnitude of headroom before the AI is what
limits the frame. That is why the pathfinder is left allocating its maps per call
rather than being rewritten around reusable buffers: the measurement says the
allocation is not worth the complexity, and `tests/Pathfinder.test.js` keeps the
expansion count honest so a heuristic regression shows up as a test failure rather
than a stutter.

## Status and roadmap

Working, and covered by tests:

- Five levels of rising difficulty, picked from the start page. A level's map, its
  chips, its guards and its posts all come from the level's own data.
- Guards patrol the shared waypoint loop, pausing and scanning at each post, and
  see the player by range, field of view **and** a clear line of sight, so walls
  and corners hide you. Certainty builds over time instead of switching on the
  first hint of a sighting.
- Guards hear the player's racket through walls, get suspicious about it, come to
  look and search where they last heard it - but a chase still needs eyes on the
  player, so noise never hunts you down on its own.
- Guards creep toward a player they are unsure about, chase along an A\* route,
  search where they last saw or heard you, and return to the post they abandoned.
- They swing when they get close enough. A hit costs a point of health and leaves
  a short window of blinking invulnerability, so two guards swinging on the same
  frame cannot cost two points between them. Three hits and the run is over.
- The player walks, sprints on a stamina bar and sneaks silently.
- A door that stays shut until every chip is in, and a HUD showing the run clock,
  health, the chip count, whether the door is open, and each guard's certainty -
  which is otherwise invisible.
- A start page: the briefing, the guards on shift, how they think and your record,
  with the level patrolling behind it and the ladder for picking one.
- Every run timed, and the record counting runs begun, escapes, captures, chips
  lifted and your best time, kept between sessions.
- `F1` toggles the debug overlay on top of the A\* route, the vision cone and the
  noise circle the guards are actually listening to.

Known gaps, in the order they are planned:

- **Only the player makes a noise.** Chips and the door are silent when they are
  handled, and guards cannot tell each other anything, so there is no way to throw
  a sound and draw a patrol off its route: everything a guard hears, it hears from
  you.
- **Difficulty is the map, not the guards.** The five levels differ in layout,
  size, chip count and guard count; every guard on every level still sees 180px,
  reacts at the same speed and searches for the same 4 seconds. Per-level sight
  ranges and reaction times would mean threading a config through every AI module,
  which is a larger change than the ladder needed. Picking a level is also free -
  nothing unlocks, and the record is one record for all five rather than one per
  level, so beating level 5 does not say so anywhere.
- **Nothing scores a run beyond how quickly you got out.** Runs are timed and the
  record is kept, but there is no rank, no target time and no reward for a quiet
  approach over a sprint.
- **The record is per-browser and anonymous.** It lives in `localStorage`, so
  clearing site data clears it, and there is nowhere for it to go but here.
- **A search always runs its full time budget in one spot**, rather than widening
  the sweep around the last known position.
- **Routes land on tile centres**, which is right for a patrol post and wrong for a
  person. A guard that is *looking* at the player walks straight at them rather
  than at the middle of their tile, so it closes the gap exactly - but a guard that
  is only walking to a remembered position can stop up to half a tile from it.
  Worth knowing when reading the AI tests, which assert on whole tiles for that
  reason.

## Dependencies

- **Phaser 3.90.0** - rendering, input, scene lifecycle, the player's collision.
  Pinned exactly, not a floating range.
- **Vite** - dev server and bundler.
- **Vitest**, **ESLint**, **Prettier** - development only.

No pathfinding or AI library is used, and no texture or audio files ship with the
game: textures are generated in code at boot, and sounds are synthesised with the
WebAudio API instead of being loaded as assets.

## Credits

MIT licensed. See [LICENSE](LICENSE).

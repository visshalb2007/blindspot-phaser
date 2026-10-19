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

- **Ten levels** of rising difficulty, chosen from a start page that shows the
  level you are about to play patrolling behind it - a ladder whose later rungs
  turn the game up on both sides of the stealth.
- **Guards that commit gradually.** A certainty meter fills while they can see or
  hear you, so a glimpse is a look and noise alone can never start a chase.
- **A run you can measure.** Every run is timed, every level keeps its own best
  escape, and the start page marks the rungs you have actually cleared.

> **Status: Phases 0-12.** Playable end to end and verified in a browser: ten
> levels, a start page ladder, guards that patrol, notice, search, chase and
> warn each other, a decoy radio for the player, and a per-level record. 394
> unit tests across 24 files, all AI performance budgets met. Where it is still
> thin is listed in [Status and roadmap](#status-and-roadmap).

## Contents

- [Getting started](#getting-started)
- [Controls](#controls)
- [A run](#a-run)
- [The ten levels](#the-ten-levels)
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
| `Q` | Drop a noise decoy (only where the level issues one) |
| `M` | Toggle audio mute / unmute |
| `F1` | Toggle the debug overlay |
| `R` | Restart the level |
| `Esc` | Leave the run and go back to the start page |

On the start page, `Space` / `Enter` / a click starts a run on the level on the
board, `1`-`0` picks a level outright, `Left` / `Right` walk the ladder, and
clicking a rung picks it.

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
  on the banner is the time the run took, and only an escape can set a best time - 
  and only an escape from level N sets *level N's* best time, which is how the
  ladder on the start page learns which rungs have been climbed. `R` counts as a
  new run rather than a continuation, which is what makes the record read as a
  history.

The whole win condition lives in `src/world/Mission.js`, which has no Phaser
import. `tests/Mission.test.js` asserts that the shipped level can be finished and
`tests/Levels.test.js` asserts it of all five, so a map edit that walls off a chip
or the door fails a test rather than making the game quietly impossible.

## The ten levels

Ten maps in the order they get harder. The ladder is on the start page, one tile
per rung: pick a number and the briefing, the roster and the level patrolling
behind the page all follow the selection, and every rung you have actually
cleared carries your own best escape from it.

| # | Level | Guards | Chips | What turns it up |
| --- | --- | --- | --- | --- |
| 1 | Night Shift | 2 | 2 | Small rooms and short sightlines: somewhere to break a view every few steps. |
| 2 | Loading Bay | 3 | 3 | One open hall with pillars: nothing to hide behind between them. |
| 3 | Cold Storage | 3 | 3 | Six straight aisles with no side doors: a guard at one end sees all of it. |
| 4 | Server Floor | 4 | 4 | Three long lanes joined by two doorways each: crossing one is a commitment. |
| 5 | The Vault | 5 | 4 | Wide open, five guards, four chips, four pillars and nowhere to go. |
| 6 | Executive Wing | 5 | 5 | Carpeted offices with the corners taken away - and your first **decoy radio**, two one-time noise lures dropped with `Q`. |
| 7 | Security Wing | 6 | 5 | **Edgy guards, deep searches**: certainty fills at 90/s (60 on the shared sheet), drains slower, and the search at your last spot runs 5.5s instead of 4. |
| 8 | The Atrium | 6 | 5 | **Sharp eyes**: 220px sight on a 110° cone, against the 180px / 90° the first five levels shipped. Long sightlines are now really long. |
| 9 | The Exchange | 7 | 5 | **The alarm relay**: the first guard to commit shouts your last position to every other guard, and the whole floor comes round to look. Chasers sprint at 165. |
| 10 | Blackout | 8 | 6 | Everything at once: 225px eyes on 105° cones, 168 chase speed, 6-second searches, the relay wired, and one decoy to buy your way through it all. |

Five things worth knowing about how this is put together:

- Levels 1-5 are geometry, exactly as they shipped: no edits, no tuning, and
  every test written against them still passes unchanged. Levels 6-10 keep the
  same machinery and turn knobs that were already honest about being knobless.
- The new difficulty is announced on the start page rather than hidden behind a
  "hard mode" number. Each level's tuning is a short sheet of fields merged
  over `CONFIG.enemy` (`world/Levels.js`), so a level tunes what it needs and
  inherits the rest - and the HUD, the start-page panels and the F1 overlay all
  quote the same numbers the guards actually run on.
- The **decoy radio** (`Q`) is the player's side of the same trade. A decoy
  blares a 170px circle for 3.5 seconds - louder than a sprint - so while it
  blares the guards hear the box and not you: sneak behind your own noise and
  the floor's attention stays exactly where you put it. It never starts a
  chase, because nothing has eyes on anyone; it buys an investigation, the same
  currency your own racket has always bought, at a price of one use per drop.
- The **alarm relay** is the guards' side. Noise has always been one-by-one;
  again, what a relay shares is a place worth looking at and a meter lifted past
  suspicion - the chase rule has not moved, and still needs eyes. On relay
  levels, one sighting is therefore a *building problem*, and running from one
  guard means running past the others already walking your way.
- Difficulty here is still the map plus a published sheet, never a multiplier
  hidden in the AI. `tests/Levels.test.js` holds all ten to what a level has to
  be - the size the game draws, no parser warnings, a spawn, a door and chips,
  every chip and the door reachable on foot from the spawn, a patrol the guards
  can walk, and thresholds that stay in a sane order after tuning.

## The start page

The game opens on a dashboard rather than in a run. Five panels say what the job
is, which keys do it, who is on shift, how they think, and what you have done so
far - and above them sits the ladder: one tile per level, numbered and clickable,
carrying your best escape wherever you have actually cleared the level, with the
selected rung lit and a line of tags under the header saying what this level
turns up (a decoy radio, an alarm relay, sharp eyes, and so on).

The numbers on it are the real ones, and that is the whole point of it being a
module rather than a wall of text calls. The chip count is read off the level, the
roster comes from the same rule `GameScene` spawns its guards from, the sight range
and the certainty thresholds are quoted from the config the guards actually run
on - `configFor(level)` builds it, so a tuned level is described as tuned - and
the record is what you have actually done, per level as well as overall. Retune a
guard and the page describes the new one - `tests/Briefing.test.js` asserts
exactly that, because a dashboard that quietly lies is worse than no dashboard.

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
browser itself. It counts runs begun, escapes, captures, chips lifted, your best
time overall, and a best escape per level, and survives a reload. Every read of
it is treated as hostile - the value came off a disk, possibly written by an
older build, possibly hand-edited -
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
it will end up standing where you were when you stopped. A guard already walking
home honours the same rules in reverse, which is why the alarm relay below needs
no special casing in the state machine at all.

**The decoy radio is the player's half of that** - on the levels that issue one,
`Q` drops a box that blares a wider circle than a sprint for 3.5 seconds. The scene
hands every guard *one* sound per frame, the loudest one being made (`world/
Decoy.js`), so while the box blares the floor listens to it and not to you - and
since a noise still only ever buys an investigation, the gadget moves attention
without ever committing anyone.

**The alarm relay is the guards' half** - on relayed levels, the first guard that
commits hands its last-known position to every other guard as intel
(`EnemyBrain.relayIntel`): a hunch plus a certainty meter lifted past suspicion,
carrying one second's worth of doubt paid up front so one frame of quiet decay
cannot erase a radio call. The chase rule has not moved - intel alone drives
nobody to a chase - but one sighting now brings the whole building round.

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
  world/     pure logic: Grid, LevelData, Levels, LineOfSight, Mission, Decoy,
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

- Ten levels of rising difficulty, picked from the start page. A level's map, its
  chips, its guards, its posts, its tuning and any gadget it issues all come from
  the level's own data.
- Levels 6-10 turn the guards up through published tuning sheets merged over the
  shared config (sharp eyes, edgy certainty, sprinting chasers, longer searches),
  and levels 9-10 wire the alarm relay, so the guards there warn each other about
  a chase. Nothing unlocks - every rung is always playable.
- On levels 6 and 10 the player is issued a **decoy radio**: `Q` drops a one-time
  noise lure that outranks the player's own racket while it blares, and the HUD
  and the start page both say how many are left.
- Guards patrol the shared waypoint loop, pausing and scanning at each post, and
  see the player by range, field of view **and** a clear line of sight, so walls
  and corners hide you. Certainty builds over time instead of switching on the
  first hint of a sighting.
- Guards hear the loudest sound being made each frame - the player's, or a blaring
  decoy's - get suspicious about it, come to look and search where they last heard
  it - but a chase still needs eyes on the player, so no noise ever hunts you down
  on its own.
- Guards creep toward a player they are unsure about, chase along an A\* route,
  search where they last saw or heard you, and return to the post they abandoned.
- They swing when they get close enough. A hit costs a point of health and leaves
  a short window of blinking invulnerability, so two guards swinging on the same
  frame cannot cost two points between them. Three hits and the run is over.
- The player walks, sprints on a stamina bar and sneaks silently.
- A door that stays shut until every chip is in, and a HUD showing the run clock,
  health, the chip count, whether the door is open, the decoy supply where one is
  issued, any relay the level is wired for, and each guard's certainty - which is
  otherwise invisible.
- A start page: the briefing, the guards on shift, how they think and your record,
  with the level patrolling behind it and a clickable ten-tile ladder for picking
  one, marked with a best escape wherever you have cleared a level.
- Every run timed, and the record counting runs begun, escapes, captures, chips
  lifted, your best time overall and one per level, kept between sessions.
- `F1` toggles the debug overlay on top of the A\* route, the vision cone - drawn
  from the level's own tuning - and the loudest sound the guards are actually
  listening to.

Known gaps, in the order they are planned:

- **The relay knows about chases, not about searches.** A guard that finds you,
  loses you and starts sweeping alone keeps it to itself until the next chase
  begins; only the first guard to *commit* shouts. Relay-on-search would make the
  floors close in faster still, so it is deliberately waiting for playtesting.
- **The decoy gets no interplay of its own.** It outranks the player while blaring
  and takes itself off the field when spent, but a guard that reaches the box has
  no way of knowing the racket is a machine rather than a person.
- **Picking a level is free.** Nothing unlocks, and there is no per-level record
  beyond the best escape time - no chip-graded rank, no target time and no reward
  for a quiet approach over a sprint.
- **The record is per-browser and anonymous.** It lives in `localStorage`, so
  clearing site data clears it, and there is nowhere for it to go but here.
- **A search always runs its full time budget in one spot**, rather than widening
  the sweep around the last known position.
- **Routes land on tile centres**, which is right for a patrol post and wrong for a
  person. A guard that is *looking* at the player walks straight at them rather
  than at the middle of their tile, so it closes the gap exactly - but a guard that
  is only walking to a remembered position can stop up to half a tile from it.
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

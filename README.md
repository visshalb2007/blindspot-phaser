# Night Shift Heist

A top-down stealth game where the guards are the point: they patrol a loop,
notice you through a range/cone/line-of-sight check, hear you through the wall
you are hiding behind, take a moment to be sure, chase you along an A\* path,
lose you, search the last place they saw or heard you, and walk back to their
post. Take the data chips, reach the door, and do not get caught. Built with
Phaser 3 and Vite in plain JavaScript, with every AI system written from scratch
and unit tested.

> Status: Phases 0-10. The game opens on a start page: a briefing, the guards on
> shift, and a record of your runs, with the level itself patrolling behind it in
> shadow mode, nobody at the controls. Two chips and a door that stays shut until
> both are in hand. Guards patrol, check range, cone *and* a clear line before
> they believe their eyes, and listen for the racket you make around corners; a
> sighting only commits them once a certainty meter fills, and noise fills that
> same meter but can never finish the job on its own - glance, look closer, hunt,
> search where they last had you, go back to the post. A landed blow costs a
> point of health; three of them and the run is over. Every run is timed, and
> both ways it can end are remembered.

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
| `Esc` | Leave the run and go back to the start page |

On the start page, `Space`, `Enter` or a click starts a run.

## The start page

The game opens on a dashboard rather than in a run. Four panels say what the job
is, which keys do it, who is on shift and how they think, and what you have done
so far.

The numbers on it are the real ones, and that is the whole point of it being a
module rather than a wall of text calls. The chip count is read off the level,
the roster comes from the same rule `GameScene` spawns its guards from, the sight
range and the certainty thresholds are quoted from the config the guards actually
run on, and the record is what you have actually done. Retune a guard and the page
describes the new one - `tests/Briefing.test.js` asserts exactly that, because a
dashboard that quietly lies is worse than no dashboard.

The level behind it is live: the same `Game` scene, in a *shadow* mode where the
walls, the chips, the door and both guards are all there and the guards walk
their loop, with no player in the level, no HUD, no input and no way for anything
to be caught. They are handed a target nobody is standing at, so they patrol with
nothing to find - which is the honest way to show a level nobody has started, and
makes the backdrop a smoke test: if the AI stops working, the start page stops
moving.

Your record is kept in `localStorage` under one versioned key, by
`world/RunStats.js`, which is handed its storage rather than reaching for the
browser itself. It counts runs begun, escapes, captures, chips lifted and your
best time, and it survives a reload. Every read of it is treated as hostile - the
value came off a disk, possibly written by an older build, possibly hand-edited -
so a corrupt scoreboard starts over rather than stopping the game from opening.
Runs are timed by a clock that counts up on the HUD line, stops with the run, and
only ever hands a best time to an escape.

## The job

Get every chip, then leave through the door.

- A chip is taken by walking within 18px of it; it pops and fades so it is clear
  which one went. The HUD keeps the count.
- The door is drawn as a faint outline while chips are outstanding - walking
  into it does nothing at all, and does not bank a win for later - and brightens
  with a pulse when the last chip turns it on.
- That is the whole win condition, and it lives in `src/world/Mission.js`, which
  has no Phaser import. `tests/Mission.test.js` asserts that the shipped level
  can be finished, so a future map edit that walls off a chip or the door fails
  a test rather than making the game quietly impossible.
- Getting caught is the other full stop. Both ends of a run hold the world still
  and wait for `R`, and both of them are written to the record.
- Runs are timed. The clock is on the HUD line, it stops with the run so the time
  on the banner is the time the run took, and the start page keeps the fastest
  escape. `R` counts as a new run rather than a continuation, which is what makes
  the record read as a history.

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
muffle rather than block, so a racket around a corner still lands at a fraction
of its volume: that is how a guard notices what it has no way to look at. What a
noise can never do is make a guard *certain*, because a chase is only ever
entered on a sighting and the meter's alarm reading is only consulted next to
one. A loud approach buys you an investigation, not a footrace.

A noise also leaves the guard with a *hunch*: a place worth walking to that it
has not been to yet. So when the doubt drains away with a hunch still pending,
the guard goes to search it instead of going home - walk too loudly past a patrol
and it will end up standing where you were when you stopped.

Neither sense sends a guard straight at you. Both feed one certainty meter that
fills while the guard can see or hear you and drains while it can neither, and
the meter decides how far the guard commits:

| Meter | State | What the guard does |
| --- | --- | --- |
| filling | `SUSPICIOUS` | Stops for a beat, then creeps toward you at patrol speed |
| full | `CHASE` | Runs an A\* route to you, or to where it last saw you |
| - | `ATTACK` | Swings once it is within arm's reach |
| - | `SEARCH` | Walks to the last place it saw *or heard* you and sweeps in place |
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
radius, the A\* route it is walking and every patrol waypoint with its order. It
also draws the circle the guards are listening to - the player's noise radius as
the game actually computes it, which is not there at all while sneaking.

## What works today

- Two guards patrol the shared waypoint loop, pausing and scanning at each post.
- They see the player by range, field of view **and** a clear line of sight, so
  walls and corners hide you, and their certainty builds over time instead of
  switching on the first hint of a sighting.
- They hear the player's racket through walls, get suspicious about it, come to
  look, and search where they last heard it - but a chase still needs eyes on
  the player, so noise never hunts you down on its own.
- They creep toward a player they are unsure about, chase along an A\* route,
  search where they last saw or heard you, and return to the post they abandoned.
- They swing when they get close enough. A hit costs a point of health and
  leaves a short window of blinking invulnerability, so two guards swinging on
  the same frame cannot cost two points between them. Three hits and you are
  caught: the level stops until `R`.
- The player walks, sprints on a stamina bar and sneaks silently.
- Two chips and a door make up the objective, so there is now something to win
  as well as something to lose.
- A start page: the briefing, the guards on shift, how they think, and your own
  record, with the level patrolling behind it and nobody at the controls.
- Every run is timed, and the record counts runs begun, escapes, captures, chips
  lifted and your best time - kept between sessions.
- A HUD shows the run clock, health, the chip count and whether the door is open,
  plus each guard's certainty, which is otherwise invisible.
- `F1` toggles the debug overlay on top of the A\* route and vision cone.

Known gaps, in the order they are planned:

- **Only the player makes a noise.** Chips and the door are silent when they are
  handled, and guards cannot tell each other anything, so there is no way to
  throw a sound and draw a patrol off its route: everything a guard hears, it
  hears from you.
- The level and its difficulty are fixed: one map, two chips, two guards, one
  speed for the lot of it. Runs are timed and the record is kept, but nothing
  scores a run beyond how quickly you got out.
- The record is per-browser and anonymous. It lives in `localStorage`, so
  clearing site data clears it, and there is nowhere for it to go but here.
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
  ai/        pure logic: StateMachine, states, Perception, Hearing,
             Alertness, Pathfinder, PathFollower, PriorityQueue
                                                       (no Phaser import)
  world/     pure logic: Grid, LevelData, LineOfSight, Mission,
             Roster, RunStats, Briefing, geometry        (no Phaser import)
  entities/  thin Phaser wrappers: Player, Enemy
  scenes/    thin Phaser wrappers: Boot, Dashboard, Game
  utils/     pure logic: Timer, Clock, Stamina, Health
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

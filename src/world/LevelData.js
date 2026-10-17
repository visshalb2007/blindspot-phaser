/**
 * The level as an ASCII grid.
 *
 * Reading the map in the source is a deliberate choice: it makes the whole
 * layout reviewable in a diff, and it keeps the project free of binary assets.
 *
 * Legend
 *   '#'  wall           '.'  floor
 *   'P'  player spawn   'E'  exit
 *   'C'  data chip      '0'..'9'  guard waypoint, visited in digit order
 *
 * The grid is parsed by `Grid`, which reports anything suspicious (a waypoint
 * walled in on all sides, a missing spawn, a short row) as a console warning
 * instead of throwing, so a slightly broken map still loads and can be fixed.
 */
export const LEVEL_ROWS = [
  '#########################',
  '#P..........#...........#',
  '#.#######...#.#####.###.#',
  '#.#.....#...#.....#.....#',
  '#.#.0...#...#####.#####.#',
  '#.#.....#...#...........#',
  '#.###.###...#.#######...#',
  '#.......1...#.#.....#...#',
  '#####.#####.#.#.#.#.#.###',
  '#.....#.....#...#C#.#...#',
  '#.#####.###.#.#.###.#.#.#',
  '#.#.......#.#.#.....#.#.#',
  '#.#.#######.#.#######.#.#',
  '#.#.#.....#.........#.#.#',
  '#...#..2..#.#####.3.#...#',
  '#####.#####.#...#.#####.#',
  '#C..........#.#.......E.#',
  '#########################',
];

export const LEGEND = Object.freeze({
  WALL: '#',
  FLOOR: '.',
  SPAWN: 'P',
  EXIT: 'E',
  CHIP: 'C',
});

/** '@' is reserved for future actor placement; digits are waypoint markers. */
export function isWaypointChar(char) {
  return char >= '0' && char <= '9';
}

export const LEVEL = Object.freeze({
  name: 'Night Shift',
  rows: LEVEL_ROWS,
});

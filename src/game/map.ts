// map.ts — pure path geometry. No game state.

import { COLS, PATH_TILES, ROWS, TILE } from './config'

export interface PathPoint {
  x: number
  y: number
}

// Pixel waypoints: tile centers; col -1 sits off-screen left.
export const PATH_PTS: PathPoint[] = PATH_TILES.map(([c, r]) => ({
  x: c * TILE + TILE / 2,
  y: r * TILE + TILE / 2,
}))

// Cumulative segment lengths for fast pointAt(dist) lookups.
const SEG_LEN: number[] = []
export const PATH_LENGTH: number = (() => {
  let total = 0
  for (let i = 1; i < PATH_PTS.length; i++) {
    const dx = PATH_PTS[i].x - PATH_PTS[i - 1].x
    const dy = PATH_PTS[i].y - PATH_PTS[i - 1].y
    const len = Math.hypot(dx, dy)
    SEG_LEN.push(len)
    total += len
  }
  return total
})()

// Position + heading at a given distance along the path.
export function pointAt(dist: number): PathPoint & { angle: number } {
  const d = Math.max(0, Math.min(PATH_LENGTH, dist))
  let acc = 0
  for (let i = 0; i < SEG_LEN.length; i++) {
    const len = SEG_LEN[i]
    if (d <= acc + len || i === SEG_LEN.length - 1) {
      const a = PATH_PTS[i]
      const b = PATH_PTS[i + 1]
      const f = len === 0 ? 0 : (d - acc) / len
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      }
    }
    acc += len
  }
  const last = PATH_PTS[PATH_PTS.length - 1]
  return { x: last.x, y: last.y, angle: 0 }
}

// Shortest distance from a point to the path polyline.
export function distToPath(x: number, y: number): number {
  let best = Infinity
  for (let i = 1; i < PATH_PTS.length; i++) {
    const a = PATH_PTS[i - 1]
    const b = PATH_PTS[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    let f = lenSq === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / lenSq
    f = Math.max(0, Math.min(1, f))
    const px = a.x + dx * f
    const py = a.y + dy * f
    const d = Math.hypot(x - px, y - py)
    if (d < best) best = d
  }
  return best
}

export function tileCenter(col: number, row: number): PathPoint {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 }
}

// A tile is buildable when it's on the board and its center is clear of the path.
export function isBuildableTile(col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false
  const c = tileCenter(col, row)
  return distToPath(c.x, c.y) > TILE * 0.7
}

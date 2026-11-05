// config.ts — every number in the game lives here. Touch this file to balance.

export const TILE = 40
export const COLS = 20
export const ROWS = 13
export const BOARD = { w: COLS * TILE, h: ROWS * TILE }

// Path waypoints in tile coords; enemies enter from col -1 (off-screen left).
export const PATH_TILES: [number, number][] = [
  [-1, 2],
  [4, 2],
  [4, 10],
  [9, 10],
  [9, 4],
  [14, 4],
  [14, 8],
  [18, 8], // heart bastion
]

export const START_GOLD = 180
export const START_LIVES = 20

export const MAX_EFFECTS = 80
export const PROJECTILE_SPEED = 280

// ---------------------------------------------------------------- towers

export type TowerKind = 'harpoon' | 'frost' | 'battery' | 'spire'

export interface TowerType {
  kind: TowerKind
  name: string
  cost: number
  dmg: number
  range: number
  rate: number // shots per second
  desc: string
}

export const TOWER_TYPES: Record<TowerKind, TowerType> = {
  harpoon: {
    kind: 'harpoon',
    name: 'Harpoon Turret',
    cost: 60,
    dmg: 12,
    range: 110,
    rate: 1.1,
    desc: 'Cheap single-target workhorse',
  },
  frost: {
    kind: 'frost',
    name: 'Frost Coral',
    cost: 80,
    dmg: 4,
    range: 95,
    rate: 0.9,
    desc: 'Slows monsters 40% for 1.2s',
  },
  battery: {
    kind: 'battery',
    name: 'Tide Battery',
    cost: 110,
    dmg: 18,
    range: 100,
    rate: 0.55,
    desc: 'Lobbed shell, splash damage',
  },
  spire: {
    kind: 'spire',
    name: 'Storm Spire',
    cost: 150,
    dmg: 30,
    range: 125,
    rate: 0.7,
    desc: 'Chain lightning, 2 extra targets',
  },
}

export const TOWER_ORDER: TowerKind[] = ['harpoon', 'frost', 'battery', 'spire']
export const MAX_LEVEL = 3
export const SELL_REFUND = 0.7

// ---------------------------------------------------------------- enemies

export type EnemyKind = 'minnow' | 'dart' | 'shoal' | 'fry' | 'brute' | 'maw'

export interface EnemyType {
  kind: EnemyKind
  name: string
  hp: number
  speed: number // px per second
  bounty: number
  dmg: number // heart damage on leak
  radius: number
  spawner?: { kind: EnemyKind; count: number; interval: number }
  boss?: boolean
}

export const ENEMY_TYPES: Record<EnemyKind, EnemyType> = {
  minnow: { kind: 'minnow', name: 'Minnow', hp: 30, speed: 60, bounty: 6, dmg: 1, radius: 9 },
  dart: { kind: 'dart', name: 'Dart', hp: 18, speed: 110, bounty: 5, dmg: 1, radius: 7 },
  shoal: {
    kind: 'shoal',
    name: 'Shoal Spawner',
    hp: 20,
    speed: 70,
    bounty: 4,
    dmg: 1,
    radius: 11,
    spawner: { kind: 'fry', count: 5, interval: 2.2 },
  },
  fry: { kind: 'fry', name: 'Fry', hp: 10, speed: 80, bounty: 2, dmg: 1, radius: 5 },
  brute: { kind: 'brute', name: 'Brute', hp: 140, speed: 38, bounty: 14, dmg: 2, radius: 13 },
  maw: {
    kind: 'maw',
    name: 'The Maw',
    hp: 450,
    speed: 30,
    bounty: 80,
    dmg: 6,
    radius: 18,
    boss: true,
  },
}

// ---------------------------------------------------------------- waves

export interface WaveGroup {
  type: EnemyKind
  count: number
  gap: number // seconds between spawns
  delay: number // seconds after wave start
  hp?: number // hp override (boss scaling per wave)
}

export interface Wave {
  groups: WaveGroup[]
  bonus: number
}

export const WAVES: Wave[] = [
  { groups: [{ type: 'minnow', count: 8, gap: 1.2, delay: 0 }], bonus: 30 },
  { groups: [{ type: 'minnow', count: 12, gap: 0.9, delay: 0 }], bonus: 35 },
  {
    groups: [
      { type: 'dart', count: 10, gap: 0.7, delay: 0 },
      { type: 'minnow', count: 6, gap: 1.2, delay: 4 },
    ],
    bonus: 40,
  },
  {
    groups: [
      { type: 'shoal', count: 3, gap: 3, delay: 0 },
      { type: 'minnow', count: 8, gap: 1, delay: 2 },
    ],
    bonus: 45,
  },
  {
    groups: [
      { type: 'brute', count: 4, gap: 4, delay: 0 },
      { type: 'minnow', count: 10, gap: 0.8, delay: 1 },
      { type: 'maw', count: 1, gap: 0, delay: 10, hp: 450 },
    ],
    bonus: 60,
  },
  { groups: [{ type: 'dart', count: 16, gap: 0.5, delay: 0 }], bonus: 45 },
  {
    groups: [
      { type: 'brute', count: 8, gap: 2.5, delay: 0 },
      { type: 'shoal', count: 3, gap: 3, delay: 6 },
    ],
    bonus: 50,
  },
  {
    groups: [
      { type: 'maw', count: 2, gap: 8, delay: 0, hp: 700 },
      { type: 'dart', count: 12, gap: 0.6, delay: 4 },
    ],
    bonus: 55,
  },
  {
    groups: [
      { type: 'brute', count: 10, gap: 2, delay: 0 },
      { type: 'shoal', count: 5, gap: 2.5, delay: 5 },
      { type: 'dart', count: 10, gap: 0.5, delay: 8 },
    ],
    bonus: 60,
  },
  {
    groups: [
      { type: 'maw', count: 1, gap: 0, delay: 0, hp: 1200 },
      { type: 'brute', count: 8, gap: 3, delay: 6 },
      { type: 'dart', count: 14, gap: 0.5, delay: 12 },
      { type: 'minnow', count: 16, gap: 0.6, delay: 18 },
    ],
    bonus: 100,
  },
]

// ---------------------------------------------------------------- shared entity shapes
// (declared here so every module shares them without circular imports)

export interface Tower {
  id: number
  kind: TowerKind
  col: number
  row: number
  x: number
  y: number
  level: number // 1..MAX_LEVEL
  invested: number
  cooldown: number
  angle: number
  fireFlash: number // seconds since last shot, for art
}

export interface Enemy {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  dist: number // distance traveled along the path, px
  x: number
  y: number
  speed: number
  bounty: number
  dmg: number
  radius: number
  boss: boolean
  slowUntil: number
  slowFactor: number // applied while g.t < slowUntil (e.g. 0.6 = 40% slow)
  spawnTimer: number // shoal fry countdown
  spawnsLeft: number
  dead: boolean
}

export interface Projectile {
  x: number
  y: number
  targetId: number // -1 once the target is gone; then flies to tx/ty
  tx: number
  ty: number
  dmg: number
  splash: number // splash radius, 0 = none
}

export interface Effect {
  kind: 'boom' | 'bolt' | 'ring' | 'harpoon' | 'hit' | 'leak'
  x: number
  y: number
  x2?: number
  y2?: number
  pts?: number[][] // bolt polyline
  r?: number
  t0: number // g.t when created
  life: number // seconds
  color?: string
}

export interface Hover {
  col: number
  row: number
  valid: boolean
}

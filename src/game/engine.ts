// engine.ts — game state shape and the update/draw orchestrators.
// No React here: the engine is pure framework-free logic (see GameCanvas.jsx).

import type { Enemy, EnemyKind, Effect, Hover, Projectile, Tower, TowerKind } from './config'
import { BOARD, START_GOLD, START_LIVES, TOWER_TYPES, WAVES } from './config'
import { updateEnemies } from './enemies'
import { updateProjectiles, updateTowers, upgradeCost, sellValue } from './towers'
import { updateWaves } from './waves'
import { drawWorld } from './art'

export type { Enemy, EnemyKind, Effect, Hover, Projectile, Tower, TowerKind }
export { BOARD, TOWER_TYPES, MAX_LEVEL } from './config'
export { upgradeCost, sellValue, placeTower, upgradeTower, sellTower, towerStats, canPlace } from './towers'
export { startWave, waveNumber, allWavesSent, setAuto, AUTO_DELAY } from './waves'

export interface Game {
  t: number
  gold: number
  lives: number
  wave: number // waves started (1-based once the current one is in flight)
  waveActive: boolean
  auto: boolean // auto-surge: next wave fires itself after a countdown
  autoTimer: number // countdown to the next auto wave, seconds
  over: boolean
  won: boolean
  kills: number
  shake: number
  nextId: number
  enemies: Enemy[]
  towers: Tower[]
  projectiles: Projectile[]
  effects: Effect[]
  occupied: Set<string>
  spawnQueue: { kind: EnemyKind; time: number; hp?: number }[]
  spawnIdx: number
  waveTime: number
  hover: Hover | null
  placing: TowerKind | null
  sfx: string[] // drained by GameCanvas each frame → audio
  selectedId: number | null
}

export function createGame(): Game {
  return {
    t: 0,
    gold: START_GOLD,
    lives: START_LIVES,
    wave: 0,
    waveActive: false,
    auto: false,
    autoTimer: 0,
    over: false,
    won: false,
    kills: 0,
    shake: 0,
    nextId: 1,
    enemies: [],
    towers: [],
    projectiles: [],
    effects: [],
    occupied: new Set(),
    spawnQueue: [],
    spawnIdx: 0,
    waveTime: 0,
    hover: null,
    placing: null,
    sfx: [],
    selectedId: null,
  }
}

export function update(g: Game, dt: number): void {
  g.t += dt
  updateWaves(g, dt)
  updateEnemies(g, dt)
  updateTowers(g, dt)
  updateProjectiles(g, dt)

  for (let i = g.effects.length - 1; i >= 0; i--) {
    if (g.t - g.effects[i].t0 >= g.effects[i].life) g.effects.splice(i, 1)
  }

  g.shake = Math.max(0, g.shake - dt * 1.6)
}

export function draw(ctx: CanvasRenderingContext2D, g: Game): void {
  drawWorld(ctx, g)
}

// Aggregated HUD snapshot for React — GameCanvas stringifies and only
// reports when this changes, so React never re-renders per frame.
export interface Hud {
  gold: number
  lives: number
  maxLives: number
  wave: number
  totalWaves: number
  waveActive: boolean
  over: boolean
  won: boolean
  kills: number
  auto: boolean
  autoCountdown: number | null // seconds until the next auto surge, null when idle/off
  placing: TowerKind | null
  selected: {
    id: number
    kind: TowerKind
    level: number
    upCost: number | null // null = max level
    sellValue: number
    affordableUp: boolean
  } | null
}

export function hudSnapshot(g: Game): Hud {
  const tower = g.selectedId != null ? g.towers.find((t) => t.id === g.selectedId) : null
  return {
    gold: Math.floor(g.gold),
    lives: g.lives,
    maxLives: START_LIVES,
    wave: g.wave,
    totalWaves: WAVES.length,
    waveActive: g.waveActive,
    over: g.over,
    won: g.won,
    kills: g.kills,
    auto: g.auto,
    autoCountdown:
      g.auto && !g.waveActive && !g.won && !g.over && g.wave < WAVES.length
        ? Math.ceil(g.autoTimer)
        : null,
    placing: g.placing,
    selected:
      tower == null
        ? null
        : {
            id: tower.id,
            kind: tower.kind,
            level: tower.level,
            upCost: tower.level < 3 ? upgradeCost(tower) : null,
            sellValue: sellValue(tower),
            affordableUp: tower.level < 3 && g.gold >= upgradeCost(tower),
          },
  }
}

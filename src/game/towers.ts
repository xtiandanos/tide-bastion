// towers.ts — placement, upgrades, selling, targeting and firing.

import type { Enemy, Game, Tower, TowerKind } from './engine'
import type { Effect } from './config'
import {
  MAX_LEVEL,
  PROJECTILE_SPEED,
  SELL_REFUND,
  TOWER_TYPES,
} from './config'
import { isBuildableTile, tileCenter } from './map'
import { addEffect, damageEnemy, slowEnemy } from './enemies'

export function upgradeCost(tower: Tower): number {
  return Math.round(TOWER_TYPES[tower.kind].cost * 0.9 * tower.level)
}

export function sellValue(tower: Tower): number {
  return Math.round(tower.invested * SELL_REFUND)
}

// Effective stats for a tower at its current level.
export function towerStats(tower: Tower) {
  const t = TOWER_TYPES[tower.kind]
  const lvl = tower.level - 1
  if (tower.kind === 'frost') {
    return {
      dmg: t.dmg * Math.pow(1.6, lvl),
      range: t.range * Math.pow(1.12, lvl),
      rate: t.rate * Math.pow(1.15, lvl),
      slowPct: Math.min(0.7, 0.4 + 0.15 * lvl),
      slowDur: 1.2 + 0.4 * lvl,
    }
  }
  return {
    dmg: t.dmg * Math.pow(1.6, lvl),
    range: t.range * Math.pow(1.12, lvl),
    rate: t.rate * Math.pow(1.15, lvl),
    slowPct: 0,
    slowDur: 0,
  }
}

export function canPlace(g: Game, col: number, row: number): boolean {
  return isBuildableTile(col, row) && !g.occupied.has(`${col},${row}`)
}

export function placeTower(g: Game, kind: TowerKind, col: number, row: number): Tower | null {
  const type = TOWER_TYPES[kind]
  if (g.gold < type.cost || !canPlace(g, col, row)) return null
  const c = tileCenter(col, row)
  const tower: Tower = {
    id: g.nextId++,
    kind,
    col,
    row,
    x: c.x,
    y: c.y,
    level: 1,
    invested: type.cost,
    cooldown: 0,
    angle: -Math.PI / 2,
    fireFlash: 99,
  }
  g.gold -= type.cost
  g.towers.push(tower)
  g.occupied.add(`${col},${row}`)
  return tower
}

export function upgradeTower(g: Game, tower: Tower): boolean {
  if (tower.level >= MAX_LEVEL) return false
  const cost = upgradeCost(tower)
  if (g.gold < cost) return false
  g.gold -= cost
  tower.level++
  tower.invested += cost
  return true
}

export function sellTower(g: Game, tower: Tower): void {
  g.gold += sellValue(tower)
  g.occupied.delete(`${tower.col},${tower.row}`)
  const i = g.towers.indexOf(tower)
  if (i >= 0) g.towers.splice(i, 1)
  if (g.selectedId === tower.id) g.selectedId = null
}

function findTarget(g: Game, tower: Tower, range: number): Enemy | null {
  // "First" targeting: the enemy furthest along the path that's in range.
  let best: Enemy | null = null
  for (const e of g.enemies) {
    if (e.dead) continue
    if (Math.hypot(e.x - tower.x, e.y - tower.y) > range) continue
    if (!best || e.dist > best.dist) best = e
  }
  return best
}

export function updateTowers(g: Game, dt: number): void {
  for (const tower of g.towers) {
    tower.fireFlash += dt
    tower.cooldown -= dt
    const s = towerStats(tower)

    const target = findTarget(g, tower, s.range)
    if (!target) continue
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x)
    if (tower.cooldown > 0) continue

    tower.cooldown = 1 / s.rate
    tower.fireFlash = 0
    fire(g, tower, target, s)
  }
}

type Stats = ReturnType<typeof towerStats>

function fire(g: Game, tower: Tower, target: Enemy, s: Stats): void {
  switch (tower.kind) {
    case 'harpoon': {
      damageEnemy(g, target, s.dmg)
      addEffect(g, {
        kind: 'harpoon',
        x: tower.x,
        y: tower.y,
        x2: target.x,
        y2: target.y,
        life: 0.12,
        color: '#dfe9ee',
      })
      break
    }
    case 'frost': {
      damageEnemy(g, target, s.dmg)
      slowEnemy(g, target, 1 - s.slowPct, s.slowDur)
      addEffect(g, {
        kind: 'ring',
        x: target.x,
        y: target.y,
        r: 16,
        life: 0.4,
        color: '#9fd8ff',
      })
      break
    }
    case 'battery': {
      const d = Math.hypot(target.x - tower.x, target.y - tower.y)
      g.projectiles.push({
        x: tower.x,
        y: tower.y,
        targetId: target.id,
        tx: target.x,
        ty: target.y,
        dmg: s.dmg,
        splash: 55,
        t: 0,
        flight: Math.max(0.2, d / PROJECTILE_SPEED), // total flight time, for arc
      })
      break
    }
    case 'spire': {
      chainLightning(g, tower, target, s.dmg)
      break
    }
  }
}

function chainLightning(g: Game, tower: Tower, primary: Enemy, dmg: number): void {
  const hitIds = new Set<number>([primary.id])
  const pts: number[][] = [
    [tower.x, tower.y],
    [primary.x, primary.y],
  ]
  damageEnemy(g, primary, dmg)

  // Arc to the two nearest additional enemies within 90px of the primary.
  const near = g.enemies
    .filter((e) => !e.dead && !hitIds.has(e.id))
    .map((e) => ({ e, d: Math.hypot(e.x - primary.x, e.y - primary.y) }))
    .filter((v) => v.d <= 90)
    .sort((a, b) => a.d - b.d)
    .slice(0, 2)

  for (const { e } of near) {
    hitIds.add(e.id)
    pts.push([e.x, e.y])
    damageEnemy(g, e, dmg * 0.6)
  }

  addEffect(g, { kind: 'bolt', x: tower.x, y: tower.y, pts, life: 0.18, color: '#c7f0ff' })
}

export function updateProjectiles(g: Game, dt: number): void {
  const projectiles = g.projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]
    p.t += dt
    const target = p.targetId >= 0 ? g.enemies.find((e) => e.id === p.targetId) : null
    if (target && !target.dead) {
      p.tx = target.x
      p.ty = target.y
    } else {
      p.targetId = -1
    }
    const dx = p.tx - p.x
    const dy = p.ty - p.y
    const d = Math.hypot(dx, dy)
    const step = PROJECTILE_SPEED * dt
    if (d <= step) {
      // Impact: splash damages everything within radius (flat).
      if (p.splash > 0) {
        for (const e of g.enemies) {
          if (!e.dead && Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) {
            damageEnemy(g, e, p.dmg)
          }
        }
        addEffect(g, { kind: 'boom', x: p.tx, y: p.ty, r: p.splash, life: 0.35, color: '#ffd28a' })
      }
      projectiles.splice(i, 1)
      continue
    }
    p.x += (dx / d) * step
    p.y += (dy / d) * step
  }
}

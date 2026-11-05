// enemies.ts — spawning, movement along the path, heart damage, deaths.

import type { Enemy, EnemyKind, Game } from './engine'
import type { Effect } from './config'
import { ENEMY_TYPES, MAX_EFFECTS } from './config'
import { PATH_LENGTH, pointAt } from './map'

export function spawnEnemy(g: Game, kind: EnemyKind, dist = 0, hpOverride?: number): Enemy {
  const t = ENEMY_TYPES[kind]
  const hp = hpOverride ?? t.hp
  const pos = pointAt(dist)
  const e: Enemy = {
    id: g.nextId++,
    kind,
    hp,
    maxHp: hp,
    dist,
    x: pos.x,
    y: pos.y,
    speed: t.speed,
    bounty: t.bounty,
    dmg: t.dmg,
    radius: t.radius,
    boss: !!t.boss,
    slowUntil: 0,
    slowFactor: 1,
    wetUntil: 0,
    stunUntil: 0,
    spawnTimer: t.spawner ? t.spawner.interval : 0,
    spawnsLeft: t.spawner ? t.spawner.count : 0,
    dead: false,
  }
  g.enemies.push(e)
  if (e.boss) {
    g.shake = 0.6
    addEffect(g, { kind: 'ring', x: pos.x, y: pos.y, r: 60, life: 0.7, color: '#b84fd0' })
  }
  return e
}

export function addEffect(g: Game, fx: Omit<Effect, 't0'>): void {
  if (g.effects.length >= MAX_EFFECTS) g.effects.shift()
  g.effects.push({ ...fx, t0: g.t })
}

// Elemental damage pipeline: armor piercing vs brutes, wet conductors take
// extra lightning, ice tint hits, water drenches.
export function damageEnemy(g: Game, e: Enemy, dmg: number, element?: string): void {
  if (e.dead) return
  let d = dmg
  if (element === 'physical' && e.kind === 'brute') d *= 1.25
  if (element === 'lightning' && g.t < e.wetUntil) d *= 1.5
  e.hp -= d
  if (e.hp <= 0) {
    e.dead = true
    g.gold += e.bounty
    g.kills++
    addEffect(g, {
      kind: 'hit',
      x: e.x,
      y: e.y,
      r: e.radius + 6,
      life: 0.25,
      color:
        element === 'ice'
          ? '#bfe9ff'
          : element === 'lightning'
            ? '#e6f0ff'
            : element === 'water'
              ? '#9fd8ff'
              : '#ffe9a8',
    })
  }
}

// Soak an enemy: lightning conducts through it for 3s.
export function wetEnemy(g: Game, e: Enemy, duration = 3): void {
  if (g.t > e.wetUntil) e.wetUntil = g.t + duration
}

export function slowEnemy(g: Game, e: Enemy, factor: number, duration: number): void {
  // The Maw shrugs off slows while above half health.
  if (e.boss && e.hp > e.maxHp / 2) return
  e.slowFactor = factor
  e.slowUntil = g.t + duration
}

export function updateEnemies(g: Game, dt: number): void {
  const enemies = g.enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    if (e.dead) {
      enemies.splice(i, 1)
      continue
    }

    const stunned = g.t < e.stunUntil
    const slowed = g.t < e.slowUntil
    const factor = stunned ? 0 : slowed ? e.slowFactor : 1
    e.dist += e.speed * factor * dt

    // Shoal spawners drip fry behind them as they travel.
    if (e.spawnsLeft > 0) {
      e.spawnTimer -= dt
      if (e.spawnTimer <= 0) {
        e.spawnTimer += ENEMY_TYPES.shoal.spawner!.interval
        e.spawnsLeft--
        spawnEnemy(g, 'fry', Math.max(0, e.dist - 14))
      }
    }

    if (e.dist >= PATH_LENGTH) {
      // Reached the heart bastion.
      enemies.splice(i, 1)
      g.lives -= e.dmg
      g.shake = Math.max(g.shake, e.boss ? 0.5 : 0.2)
      addEffect(g, { kind: 'leak', x: e.x, y: e.y, r: 20, life: 0.5, color: '#ff7a6b' })
      if (g.lives <= 0) {
        g.lives = 0
        g.over = true
      }
      continue
    }

    const pos = pointAt(e.dist)
    e.x = pos.x
    e.y = pos.y
  }
}

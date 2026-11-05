// waves.ts — the surge spawner: schedules, wave-clear detection, bonuses.

import type { Game } from './engine'
import { ENEMY_TYPES, WAVES } from './config'
import { spawnEnemy } from './enemies'

interface SpawnEntry {
  kind: (typeof WAVES)[number]['groups'][number]['type']
  time: number
  hp?: number
}

export function waveNumber(g: Game): number {
  return g.wave
}

export function allWavesSent(g: Game): boolean {
  return g.wave >= WAVES.length
}

// Send the next surge. No-op if a wave is already running or all are done.
export function startWave(g: Game): boolean {
  if (g.waveActive || g.wave >= WAVES.length) return false
  const wave = WAVES[g.wave]
  const schedule: SpawnEntry[] = []
  for (const group of wave.groups) {
    // difficulty ramp: per-wave hpMul scales every spawn unless the group
    // pins its own hp (bosses do, so their fights stay tuned)
    const hp = group.hp ?? Math.round(ENEMY_TYPES[group.type].hp * wave.hpMul)
    for (let i = 0; i < group.count; i++) {
      schedule.push({ kind: group.type, time: group.delay + i * group.gap, hp })
    }
  }
  schedule.sort((a, b) => a.time - b.time)
  g.spawnQueue = schedule
  g.spawnIdx = 0
  g.waveTime = 0
  g.wave++ // wave is now "in flight"; 1-based for display
  g.waveActive = true
  return true
}

export function updateWaves(g: Game, dt: number): void {
  if (!g.waveActive) return
  g.waveTime += dt

  while (g.spawnIdx < g.spawnQueue.length && g.spawnQueue[g.spawnIdx].time <= g.waveTime) {
    const entry = g.spawnQueue[g.spawnIdx++]
    spawnEnemy(g, entry.kind, 0, entry.hp)
  }

  // Wave clears when everything has spawned and been dealt with.
  if (g.spawnIdx >= g.spawnQueue.length && g.enemies.length === 0) {
    g.waveActive = false
    const wave = WAVES[g.wave - 1]
    g.gold += wave.bonus
    if (g.wave >= WAVES.length) {
      g.won = true
    }
  }
}

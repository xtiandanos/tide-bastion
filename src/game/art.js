// art.js — ALL procedural drawing. Pure functions of (ctx, g). No image assets.
// Style: layered teal water with slow caustics, sandy path with foam edges,
// bigFish-adjacent silhouettes. Fake glows with translucent circles (never
// ctx.shadowBlur per entity — tanks mobile fps).

import { BOARD, COLS, ROWS, TILE, TOWER_TYPES } from './config'
import { PATH_PTS, PATH_LENGTH, pointAt, isBuildableTile } from './map'

// ---------------------------------------------------------------- helpers


function circle(ctx, x, y, r, fill) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
}

function fakeGlow(ctx, x, y, r, color, alpha) {
  ctx.globalAlpha = alpha
  circle(ctx, x, y, r, color)
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- world

export function drawWorld(ctx, g) {
  const t = g.t

  ctx.save()
  if (g.shake > 0) {
    const s = g.shake * 6
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }

  drawWater(ctx, t)
  drawPath(ctx, t)
  drawHeart(ctx, t, g.lives)

  for (const tower of g.towers) drawTower(ctx, tower, t)
  for (const e of g.enemies) drawEnemy(ctx, e, t)
  for (const p of g.projectiles) drawProjectile(ctx, p)
  drawEffects(ctx, g)

  // placement ghost + range ring
  if (g.placing && g.hover) {
    drawGhost(ctx, g)
  }

  // selected tower ring
  if (g.selectedId != null) {
    const sel = g.towers.find((tw) => tw.id === g.selectedId)
    if (sel) {
      const s = towerRange(sel)
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 6])
      circle(ctx, sel.x, sel.y, s)
      ctx.stroke()
      ctx.setLineDash([])
      drawLevelPips(ctx, sel)
    }
  }

  ctx.restore()
}

function drawWater(ctx, t) {
  // deep gradient
  const grad = ctx.createLinearGradient(0, 0, 0, BOARD.h)
  grad.addColorStop(0, '#0d4a5e')
  grad.addColorStop(0.55, '#0a3b4d')
  grad.addColorStop(1, '#072e3d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, BOARD.w, BOARD.h)

  // slow caustic bands
  ctx.globalAlpha = 0.06
  ctx.strokeStyle = '#9fe8ff'
  ctx.lineWidth = 10
  for (let i = 0; i < 5; i++) {
    const yBase = 80 + i * 110
    ctx.beginPath()
    for (let x = 0; x <= BOARD.w; x += 16) {
      const y = yBase + Math.sin(x * 0.012 + t * 0.5 + i * 1.7) * 14 + Math.sin(x * 0.03 - t * 0.3) * 6
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // buildable-tile hints: faint dots on the grid (very subtle)
  ctx.fillStyle = 'rgba(255,255,255,0.045)'
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isBuildableTile(c, r)) continue
      circle(ctx, c * TILE + TILE / 2, r * TILE + TILE / 2, 1.4, 'rgba(255,255,255,0.045)')
    }
  }
}

function drawPath(ctx, t) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // sand bed
  ctx.strokeStyle = '#c8b487'
  ctx.lineWidth = TILE * 0.78
  tracePath(ctx)
  ctx.stroke()

  // wet center stripe
  ctx.strokeStyle = '#b3a077'
  ctx.lineWidth = TILE * 0.5
  tracePath(ctx)
  ctx.stroke()

  // animated foam edges
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#dff4f2'
  ctx.lineWidth = 3
  ctx.setLineDash([10, 14])
  ctx.lineDashOffset = -t * 22 // flows toward the heart
  ctx.lineWidth = TILE * 0.78
  tracePath(ctx)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

function tracePath(ctx) {
  ctx.beginPath()
  ctx.moveTo(PATH_PTS[0].x, PATH_PTS[0].y)
  for (let i = 1; i < PATH_PTS.length; i++) ctx.lineTo(PATH_PTS[i].x, PATH_PTS[i].y)
}

function drawHeart(ctx, t, lives) {
  const end = pointAt(PATH_LENGTH)
  const pulse = 1 + Math.sin(t * 4) * 0.06
  const crisis = lives <= 5
  const beat = crisis ? 1 + Math.sin(t * 9) * 0.12 : pulse

  fakeGlow(ctx, end.x, end.y, 30 * beat, crisis ? 'rgba(255,110,90,0.25)' : 'rgba(126,232,208,0.18)')

  // stone bastion
  circle(ctx, end.x, end.y, 17, '#3c5a66')
  circle(ctx, end.x, end.y, 14, '#4d7280')

  // heart glyph
  ctx.save()
  ctx.translate(end.x, end.y)
  ctx.scale(beat, beat)
  ctx.fillStyle = crisis ? '#ff6b5e' : '#ff8b9e'
  ctx.beginPath()
  ctx.moveTo(0, 5)
  ctx.bezierCurveTo(-8, -2, -6, -9, 0, -5)
  ctx.bezierCurveTo(6, -9, 8, -2, 0, 5)
  ctx.fill()
  ctx.restore()
}

// ---------------------------------------------------------------- towers

function towerRange(tower) {
  const type = TOWER_TYPES[tower.kind]
  return type.range * Math.pow(1.12, tower.level - 1)
}

function drawTower(ctx, tower, t) {
  const { x, y, kind, level, fireFlash } = tower
  const scale = 1 + (level - 1) * 0.08

  // base pad
  circle(ctx, x, y, 15 * scale, 'rgba(10,35,45,0.55)')
  circle(ctx, x, y, 13 * scale, '#2e5261')

  if (kind === 'harpoon') {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tower.angle)
    ctx.fillStyle = '#8fb4c4'
    ctx.fillRect(-4, -4, 10, 8)
    ctx.strokeStyle = '#dfe9ee'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(4, 0)
    ctx.lineTo(16, 0)
    ctx.stroke()
    // barb
    ctx.beginPath()
    ctx.moveTo(16, 0)
    ctx.lineTo(12, -3)
    ctx.moveTo(16, 0)
    ctx.lineTo(12, 3)
    ctx.stroke()
    ctx.restore()
    if (fireFlash < 0.1) fakeGlow(ctx, x, y, 18, 'rgba(223,233,238,0.3)')
  } else if (kind === 'frost') {
    // coral branches
    ctx.strokeStyle = '#7fc4e8'
    ctx.lineCap = 'round'
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45 + Math.sin(t * 1.2 + i) * 0.05
      ctx.lineWidth = 3 * scale
      ctx.beginPath()
      ctx.moveTo(x, y + 2)
      ctx.quadraticCurveTo(
        x + Math.cos(a) * 6 * scale,
        y + Math.sin(a) * 8 * scale,
        x + Math.cos(a) * 11 * scale,
        y + Math.sin(a) * 12 * scale,
      )
      ctx.stroke()
    }
    const glow = fireFlash < 0.25 ? 0.45 : 0.15
    fakeGlow(ctx, x, y, 14 * scale, 'rgba(159,216,255,0.5)', glow)
  } else if (kind === 'battery') {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tower.angle)
    // mortar tube
    ctx.fillStyle = '#c9a86a'
    ctx.fillRect(0, -5, 14 * scale, 10 * scale)
    circle(ctx, 0, 0, 7 * scale, '#a98c55')
    ctx.restore()
    if (fireFlash < 0.15) fakeGlow(ctx, x, y, 16, 'rgba(255,210,138,0.4)')
  } else if (kind === 'spire') {
    // tall crystal spire
    const h = 22 * scale
    ctx.fillStyle = '#6f7fd8'
    ctx.beginPath()
    ctx.moveTo(x, y - h)
    ctx.lineTo(x + 8 * scale, y)
    ctx.lineTo(x, y + 4)
    ctx.lineTo(x - 8 * scale, y)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#9aa8ff'
    ctx.beginPath()
    ctx.moveTo(x, y - h)
    ctx.lineTo(x + 4 * scale, y)
    ctx.lineTo(x, y + 2)
    ctx.closePath()
    ctx.fill()
    const glow = fireFlash < 0.2 ? 0.5 : 0.18 + Math.sin(t * 2.4) * 0.06
    fakeGlow(ctx, x, y - h * 0.4, 14 * scale, 'rgba(199,240,255,0.6)', glow)
  }

  drawLevelPips(ctx, tower)
}

function drawLevelPips(ctx, tower) {
  const n = tower.level - 1
  if (n <= 0) return
  for (let i = 0; i < n; i++) {
    circle(ctx, tower.x - 5 + i * 10, tower.y + 18, 2.5, '#ffd76b')
  }
}

function drawGhost(ctx, g) {
  const { col, row } = g.hover
  const x = col * TILE + TILE / 2
  const y = row * TILE + TILE / 2
  const type = TOWER_TYPES[g.placing]
  const valid = isBuildableTile(col, row) && !g.occupied.has(`${col},${row}`) && g.gold >= type.cost

  const range = type.range
  ctx.globalAlpha = 0.14
  circle(ctx, x, y, range, valid ? '#7ee8d0' : '#ff7a6b')
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = valid ? '#7ee8d0' : '#ff7a6b'
  ctx.lineWidth = 1.5
  circle(ctx, x, y, range)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.globalAlpha = 0.65
  circle(ctx, x, y, 13, valid ? '#3f6b78' : '#7a4040')
  ctx.globalAlpha = 1

  if (!valid) {
    ctx.strokeStyle = '#ff7a6b'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(x - 8, y - 8)
    ctx.lineTo(x + 8, y + 8)
    ctx.moveTo(x + 8, y - 8)
    ctx.lineTo(x - 8, y + 8)
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- enemies

function drawEnemy(ctx, e, t) {
  const { x, y, kind } = e
  const wag = Math.sin(t * 10 + e.id * 2) * 0.25

  if (kind === 'minnow' || kind === 'fry' || kind === 'dart') {
    const size = kind === 'fry' ? 0.6 : kind === 'dart' ? 0.85 : 1
    const color = kind === 'dart' ? '#ffd76b' : kind === 'fry' ? '#a9d6c8' : '#8fd0c2'
    fish(ctx, x, y, 10 * size, color, wag, Math.sin(t * 12 + e.id) * 0.12)
  } else if (kind === 'shoal') {
    fish(ctx, x, y, 13, '#c98fd0', wag, Math.sin(t * 8 + e.id) * 0.1)
    // egg dots
    ctx.fillStyle = '#f2d9f5'
    circle(ctx, x - 2, y - 2, 1.8)
    ctx.fill()
    circle(ctx, x + 3, y - 1, 1.8)
    ctx.fill()
    circle(ctx, x, y + 3, 1.8)
    ctx.fill()
  } else if (kind === 'brute') {
    // armored turtle-brute
    ctx.save()
    ctx.translate(x, y)
    circle(ctx, 0, 0, 13, '#5a7a4a')
    circle(ctx, 0, 0, 10, '#7a9a5f')
    // spikes
    ctx.fillStyle = '#40573a'
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.4
      const sx = Math.cos(a) * 12
      const sy = Math.sin(a) * 12
      ctx.beginPath()
      ctx.moveTo(sx * 0.6, sy * 0.6)
      ctx.lineTo(Math.cos(a - 0.2) * 16, Math.sin(a - 0.2) * 16)
      ctx.lineTo(Math.cos(a + 0.2) * 16, Math.sin(a + 0.2) * 16)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#1d2b1a'
    circle(ctx, -5, -2, 2)
    ctx.fill()
    circle(ctx, 5, -2, 2)
    ctx.fill()
    ctx.restore()
  } else if (kind === 'maw') {
    // boss: big maw with teeth + aura
    fakeGlow(ctx, x, y, 30, 'rgba(184,79,208,0.25)', 0.5 + Math.sin(t * 3) * 0.15)
    ctx.save()
    ctx.translate(x, y)
    const chomp = Math.abs(Math.sin(t * 2.2)) * 0.35 + 0.25
    circle(ctx, 0, 0, 18, '#6e2f86')
    circle(ctx, 0, 0, 15, '#8b3ea6')
    // mouth
    ctx.fillStyle = '#2b0d3a'
    ctx.beginPath()
    ctx.ellipse(3, 2, 10, 10 * chomp + 2, 0, 0, Math.PI * 2)
    ctx.fill()
    // teeth
    ctx.fillStyle = '#f4ecff'
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 0.35 + (i / 4) * Math.PI * 0.7
      const tx = 3 + Math.cos(a) * 9
      const ty = 2 + Math.sin(a) * (9 * chomp + 1)
      ctx.beginPath()
      ctx.moveTo(tx - 2, ty - 3)
      ctx.lineTo(tx + 2, ty - 3)
      ctx.lineTo(tx, ty + 2)
      ctx.closePath()
      ctx.fill()
    }
    // eyes
    ctx.fillStyle = '#ffd76b'
    circle(ctx, -8, -8, 3)
    ctx.fill()
    circle(ctx, 8, -8, 3)
    ctx.fill()
    ctx.fillStyle = '#1a0a24'
    circle(ctx, -8, -8, 1.4)
    ctx.fill()
    circle(ctx, 8, -8, 1.4)
    ctx.fill()
    ctx.restore()
  }

  // slow indicator
  if (e.slowUntil > t) {
    ctx.globalAlpha = 0.4
    circle(ctx, x, y, e.radius + 4, '#9fd8ff')
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // hp bar when damaged
  if (e.hp < e.maxHp) {
    const w = e.boss ? 40 : 22
    const frac = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = 'rgba(8,20,28,0.7)'
    ctx.fillRect(x - w / 2, y - e.radius - 9, w, 4)
    ctx.fillStyle = e.boss ? '#b84fd0' : frac > 0.5 ? '#7ee8d0' : '#ff7a6b'
    ctx.fillRect(x - w / 2, y - e.radius - 9, w * frac, 4)
  }
}

function fish(ctx, x, y, size, color, wag, bob) {
  const yy = y + bob
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, yy, size, size * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
  // tail
  ctx.beginPath()
  ctx.moveTo(x - size * 0.8, yy)
  ctx.lineTo(x - size * 1.4, yy - size * 0.5 + wag * size)
  ctx.lineTo(x - size * 1.4, yy + size * 0.5 + wag * size)
  ctx.closePath()
  ctx.fill()
  // eye
  ctx.fillStyle = '#0b2028'
  circle(ctx, x + size * 0.45, yy - size * 0.15, Math.max(1.2, size * 0.14))
  ctx.fill()
}

// ---------------------------------------------------------------- projectiles & effects

function drawProjectile(ctx, p) {
  fakeGlow(ctx, p.x, p.y, 6, 'rgba(255,210,138,0.5)')
  circle(ctx, p.x, p.y, 4, '#ffd28a')
}

function drawEffects(ctx, g) {
  for (const fx of g.effects) {
    const age = (g.t - fx.t0) / fx.life
    if (age < 0 || age > 1) continue
    switch (fx.kind) {
      case 'boom': {
        ctx.globalAlpha = 0.5 * (1 - age)
        circle(ctx, fx.x, fx.y, fx.r * (0.4 + age * 0.7), fx.color)
        ctx.fill()
        ctx.globalAlpha = 1
        break
      }
      case 'ring': {
        ctx.globalAlpha = 0.6 * (1 - age)
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 2.5
        circle(ctx, fx.x, fx.y, (fx.r || 20) * (0.3 + age))
        ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
      case 'harpoon':
      case 'bolt': {
        ctx.globalAlpha = 1 - age
        ctx.strokeStyle = fx.color
        ctx.lineWidth = fx.kind === 'bolt' ? 2 : 1.5
        const pts = fx.kind === 'bolt' ? fx.pts : [[fx.x, fx.y], [fx.x2, fx.y2]]
        ctx.beginPath()
        for (let i = 0; i < pts.length; i++) {
          // jagged bolts
          const [px, py] = pts[i]
          const jitter = fx.kind === 'bolt' && i > 0 && i < pts.length - 1 ? 3 : 0
          const jx = jitter ? px + (Math.random() - 0.5) * jitter * 2 : px
          const jy = jitter ? py + (Math.random() - 0.5) * jitter * 2 : py
          if (i === 0) ctx.moveTo(jx, jy)
          else ctx.lineTo(jx, jy)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
      case 'hit': {
        ctx.globalAlpha = 0.7 * (1 - age)
        circle(ctx, fx.x, fx.y, (fx.r || 10) * (0.5 + age), fx.color)
        ctx.fill()
        ctx.globalAlpha = 1
        break
      }
      case 'leak': {
        ctx.globalAlpha = 0.7 * (1 - age)
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 3
        circle(ctx, fx.x, fx.y, (fx.r || 20) * (0.5 + age))
        ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
    }
  }
}

// art.js — ALL procedural drawing. Pure functions of (ctx, g). No image assets.
// Layered teal water with god rays, caustics, drifting bubbles and ambient
// sea life; detailed animated creatures (undulating fish, rowing turtles,
// anglerfish boss); towers that recoil, sway and spark. Fake glows with
// translucent circles (never ctx.shadowBlur per entity — tanks mobile fps).

import { BOARD, COLS, ROWS, TILE, TOWER_TYPES } from './config'
import { PATH_PTS, PATH_LENGTH, pointAt, isBuildableTile } from './map'

// Deterministic pseudo-random — stable visuals frame to frame.
function rnd(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// lighten (f > 0) or darken (f < 0) a #rrggbb color — pseudo-3D shading kit
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => {
    const out = f >= 0 ? v + (255 - v) * f : v * (1 + f)
    return Math.max(0, Math.min(255, Math.round(out)))
  }
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `rgb(${r},${g},${b})`
}

// vertical volume gradient: lit top, shaded bottom — the core 3D look
function volGrad(ctx, x, y, r, hex, f = 0.35) {
  const g = ctx.createLinearGradient(x, y - r, x, y + r)
  g.addColorStop(0, shade(hex, f))
  g.addColorStop(0.55, hex)
  g.addColorStop(1, shade(hex, -f))
  return g
}

// soft contact shadow under a creature/structure — grounds it in the scene
function groundShadow(ctx, x, y, rx, ry, alpha = 0.3) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#03121b'
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

// crescent rim-light along a shape's top edge
function rimLight(ctx, x, y, rx, ry, color = 'rgba(255,255,255,0.5)') {
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(x, y, rx * 0.92, ry * 0.92, 0, Math.PI * 1.15, Math.PI * 1.85)
  ctx.stroke()
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
  drawAmbientLife(ctx, t)
  drawPath(ctx, t)
  drawHeart(ctx, t, g.lives)

  for (const tower of g.towers) drawTower(ctx, tower, t)
  for (const e of g.enemies) drawEnemy(ctx, e, t)
  for (const p of g.projectiles) drawProjectile(ctx, p)
  drawEffects(ctx, g)

  if (g.placing && g.hover) drawGhost(ctx, g, t)

  if (g.selectedId != null) {
    const sel = g.towers.find((tw) => tw.id === g.selectedId)
    if (sel) {
      const range = TOWER_TYPES[sel.kind].range * Math.pow(1.12, sel.level - 1)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([7, 7])
      ctx.lineDashOffset = -t * 20
      ctx.beginPath()
      ctx.arc(sel.x, sel.y, range, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      drawLevelPips(ctx, sel, t)
    }
  }

  drawVignette(ctx)
  ctx.restore()
}

// ---------------------------------------------------------------- water

function drawWater(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, BOARD.h)
  grad.addColorStop(0, '#0e556c')
  grad.addColorStop(0.5, '#0a3d50')
  grad.addColorStop(1, '#06293a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, BOARD.w, BOARD.h)

  drawGodRays(ctx, t)
  drawCaustics(ctx, t)
  drawBubbles(ctx, t)

  // buildable hints: faint dots on the grid
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (!isBuildableTile(c, r)) continue
      ctx.beginPath()
      ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Sunbeams swaying from the surface.
function drawGodRays(ctx, t) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(t * 0.25 + i * 1.9) * 60
    const xTop = 90 + i * 200 + sway * 0.4
    const xBot = xTop + 120 + sway
    const wTop = 50 + rnd(i * 7) * 40
    const grad = ctx.createLinearGradient(0, 0, 0, BOARD.h)
    grad.addColorStop(0, `rgba(140,235,255,${0.07 + rnd(i * 3) * 0.04})`)
    grad.addColorStop(1, 'rgba(140,235,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(xTop - wTop, -10)
    ctx.lineTo(xTop + wTop, -10)
    ctx.lineTo(xBot + wTop * 2.2, BOARD.h)
    ctx.lineTo(xBot - wTop * 2.2, BOARD.h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// Shimmering light bands on the sea floor.
function drawCaustics(ctx, t) {
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = '#aef2ff'
  ctx.lineCap = 'round'
  for (let i = 0; i < 6; i++) {
    const yBase = 60 + i * 95
    ctx.lineWidth = 4 + rnd(i * 11) * 6
    ctx.beginPath()
    for (let x = 0; x <= BOARD.w; x += 14) {
      const y =
        yBase +
        Math.sin(x * 0.013 + t * 0.5 + i * 1.7) * 13 +
        Math.sin(x * 0.031 - t * 0.34 + i) * 6
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// Columns of bubbles rising steadily (seeded → stable).
function drawBubbles(ctx, t) {
  ctx.strokeStyle = 'rgba(200,240,250,0.22)'
  ctx.fillStyle = 'rgba(200,240,250,0.10)'
  ctx.lineWidth = 1
  for (let i = 0; i < 14; i++) {
    const x = rnd(i * 13) * BOARD.w
    const speed = 14 + rnd(i * 5) * 22
    const y = BOARD.h + 20 - ((t * speed + rnd(i * 29) * BOARD.h * 2) % (BOARD.h + 40))
    const r = 1.5 + rnd(i * 17) * 2.5
    const wob = Math.sin(t * 1.6 + i * 2.1) * 5
    ctx.beginPath()
    ctx.arc(x + wob, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}

// Ambient creatures that belong to the sea, not the wave: a small school
// crossing occasionally and slow jellyfish drifting upward.
function drawAmbientLife(ctx, t) {
  // school of background fish silhouettes
  ctx.save()
  ctx.globalAlpha = 0.16
  const cycle = 34 // seconds per crossing
  for (let s = 0; s < 2; s++) {
    const lead = ((t + s * cycle * 0.5) % cycle) / cycle
    const bx = -80 + lead * (BOARD.w + 160)
    const by = 90 + s * 330 + Math.sin(t * 0.7 + s) * 10
    for (let i = 0; i < 5; i++) {
      const fx = bx - i * 22 - rnd(i + s * 9) * 10
      const fy = by + Math.sin(i * 1.3 + s * 2) * 14 + Math.sin(t * 3 + i) * 2
      ctx.fillStyle = '#0d2836'
      ctx.beginPath()
      ctx.ellipse(fx, fy, 9, 4, Math.sin(t * 6 + i) * 0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(fx - 8, fy)
      ctx.lineTo(fx - 14, fy - 4 + Math.sin(t * 8 + i) * 2)
      ctx.lineTo(fx - 14, fy + 4 + Math.sin(t * 8 + i) * 2)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()

  // drifting jellyfish
  for (let j = 0; j < 3; j++) {
    const jx = 120 + rnd(j * 31 + 2) * (BOARD.w - 240)
    const cycle = 26 + j * 9
    const jy = BOARD.h + 40 - ((t * (7 + j * 2) + rnd(j * 7) * BOARD.h * 2) % (BOARD.h + 80))
    const drift = Math.sin(t * 0.5 + j * 2.4) * 14
    drawJelly(ctx, jx + drift, jy, 10 + rnd(j * 3) * 6, t, j)
  }
}

function drawJelly(ctx, x, y, r, t, seed) {
  const pulse = Math.sin(t * 1.4 + seed * 2) * 0.12
  ctx.save()
  ctx.globalAlpha = 0.14
  ctx.fillStyle = '#bfe3ff'
  ctx.beginPath()
  ctx.ellipse(x, y, r * (1 + pulse), r * (0.85 - pulse), 0, Math.PI, 0)
  ctx.fill()
  ctx.strokeStyle = '#bfe3ff'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 4; i++) {
    const tx = x - r * 0.6 + i * (r * 0.4)
    ctx.beginPath()
    ctx.moveTo(tx, y)
    for (let s = 1; s <= 3; s++) {
      ctx.lineTo(
        tx + Math.sin(t * 2 + i + s + seed) * 3 * s * 0.5,
        y + s * r * 0.5,
      )
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------- path

function drawPath(ctx, t) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // sand bed
  ctx.strokeStyle = '#c9b58a'
  ctx.lineWidth = TILE * 0.78
  tracePath(ctx)
  ctx.stroke()

  // wet center stripe
  ctx.strokeStyle = '#b4a179'
  ctx.lineWidth = TILE * 0.5
  tracePath(ctx)
  ctx.stroke()

  // seeded speckles / pebbles for texture
  ctx.fillStyle = 'rgba(90,72,48,0.35)'
  for (let i = 0; i < 46; i++) {
    const d = rnd(i * 3 + 1) * PATH_LENGTH
    const off = (rnd(i * 5 + 2) - 0.5) * TILE * 0.5
    const p = pointAt(d)
    const nx = -Math.sin(p.angle)
    const ny = Math.cos(p.angle)
    ctx.beginPath()
    ctx.arc(p.x + nx * off, p.y + ny * off, 1 + rnd(i * 7) * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // static foam edges
  ctx.strokeStyle = 'rgba(223,244,242,0.4)'
  ctx.lineWidth = TILE * 0.78 + 3
  tracePath(ctx)
  ctx.stroke()
  ctx.strokeStyle = '#c9b58a'
  ctx.lineWidth = TILE * 0.78
  tracePath(ctx)
  ctx.stroke()

  // two animated foam dash layers flowing toward the heart
  for (let layer = 0; layer < 2; layer++) {
    ctx.globalAlpha = layer === 0 ? 0.5 : 0.3
    ctx.strokeStyle = '#e6fbf8'
    ctx.lineWidth = layer === 0 ? 3 : 6
    ctx.setLineDash(layer === 0 ? [10, 16] : [4, 30])
    ctx.lineDashOffset = -t * (layer === 0 ? 22 : 40)
    ctx.lineWidth = TILE * (layer === 0 ? 0.78 : 0.5)
    tracePath(ctx)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1
}

function tracePath(ctx) {
  ctx.beginPath()
  ctx.moveTo(PATH_PTS[0].x, PATH_PTS[0].y)
  for (let i = 1; i < PATH_PTS.length; i++) ctx.lineTo(PATH_PTS[i].x, PATH_PTS[i].y)
}

// ---------------------------------------------------------------- heart bastion

function drawHeart(ctx, t, lives) {
  const end = pointAt(PATH_LENGTH)
  const crisis = lives <= 5
  const beat = crisis ? Math.sin(t * 9) : Math.sin(t * 3.2)
  const bob = Math.sin(t * 1.6) * 2

  // stone platform
  ctx.save()
  ctx.translate(end.x, end.y)
  ctx.fillStyle = 'rgba(8,24,32,0.5)'
  ctx.beginPath()
  ctx.ellipse(0, 6, 26, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#33505d'
  ctx.beginPath()
  ctx.ellipse(0, 4, 24, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#486e7c'
  ctx.beginPath()
  ctx.ellipse(0, 1, 24, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  // stone block seams
  ctx.strokeStyle = 'rgba(10,26,34,0.5)'
  ctx.lineWidth = 1
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 9 - 4, -6 + Math.abs(i) * 1.2)
    ctx.lineTo(i * 9 - 4, 8)
    ctx.stroke()
  }

  // pillar
  ctx.fillStyle = '#3d5f6d'
  ctx.fillRect(-13, -22, 26, 20)
  ctx.fillStyle = '#517a89'
  ctx.fillRect(-13, -22, 26, 5)
  ctx.strokeStyle = 'rgba(10,26,34,0.4)'
  for (let i = 0; i < 3; i++) {
    ctx.strokeRect(-13 + i * 9 + 1, -17, 7, 14)
  }

  // aura pulse rings
  const aura = (t * 0.7) % 1
  ctx.globalAlpha = 0.35 * (1 - aura)
  ctx.strokeStyle = crisis ? '#ff8b7e' : '#7ee8d0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, -2, 26 + aura * 30, 18 + aura * 22, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  // floating heart crystal
  const hy = -32 + bob
  const hs = 1 + beat * 0.08
  fakeGlow(ctx, 0, hy, 16 * hs, crisis ? 'rgba(255,110,90,0.3)' : 'rgba(126,232,208,0.22)')
  ctx.fillStyle = crisis ? '#ff6b5e' : '#ff8b9e'
  ctx.beginPath()
  ctx.moveTo(0, hy + 8 * hs)
  ctx.bezierCurveTo(-11 * hs, hy - 2 * hs, -8 * hs, hy - 12 * hs, 0, hy - 6 * hs)
  ctx.bezierCurveTo(8 * hs, hy - 12 * hs, 11 * hs, hy - 2 * hs, 0, hy + 8 * hs)
  ctx.fill()
  // glint
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath()
  ctx.ellipse(-3 * hs, hy - 4 * hs, 1.6, 2.6, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // orbiting sparkles
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + (i / 3) * Math.PI * 2
    const sx = Math.cos(a) * 16
    const sy = hy + Math.sin(a) * 6
    ctx.globalAlpha = 0.4 + Math.sin(t * 5 + i * 2) * 0.3
    ctx.fillStyle = '#d9fff6'
    ctx.beginPath()
    ctx.arc(sx, sy, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ---------------------------------------------------------------- towers
// Design language: every tower sits on an ornate stone pedestal with a gold
// rim; materials are polished bronze, pale ice, brass and arcane crystal.

const GOLD = '#e8c877'
const GOLD_DARK = '#a8873e'

function drawTower(ctx, tower, t) {
  const { x, y, kind, level } = tower
  const scale = 1.45 + (level - 1) * 0.12

  // ornate pedestal: contact shadow → stepped stone drum → gold rim → spokes
  ctx.save()
  ctx.translate(x, y)
  groundShadow(ctx, 0, 7, 20 * scale, 13 * scale, 0.5)
  // lower drum (darker, in shadow)
  ctx.fillStyle = volGrad(ctx, 0, 4, 8, '#24485a', 0.25)
  ctx.beginPath()
  ctx.ellipse(0, 5, 19 * scale, 13 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  // upper drum
  ctx.fillStyle = volGrad(ctx, 0, 0, 8, '#3d6878')
  ctx.beginPath()
  ctx.ellipse(0, 0, 15.5 * scale, 10.5 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  // stepped edge highlight
  rimLight(ctx, 0, 0, 15.5 * scale, 10.5 * scale, 'rgba(190,240,255,0.4)')
  // gold rim, doubled for a carved look
  ctx.strokeStyle = GOLD_DARK
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, 15.5 * scale, 10.5 * scale, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(0, -1.2, 14.5 * scale, 9.6 * scale, 0, 0, Math.PI * 2)
  ctx.stroke()
  // radial spokes
  ctx.strokeStyle = 'rgba(10,26,34,0.5)'
  ctx.lineWidth = 1
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI + Math.PI
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * 14 * scale, Math.sin(a) * 9.5 * scale)
    ctx.stroke()
  }
  ctx.restore()

  if (kind === 'harpoon') drawHarpoon(ctx, tower, scale, t)
  else if (kind === 'frost') drawFrost(ctx, tower, scale, t)
  else if (kind === 'battery') drawBattery(ctx, tower, scale, t)
  else if (kind === 'spire') drawSpire(ctx, tower, scale, t)

  drawElementAura(ctx, tower, t)
  drawLevelPips(ctx, tower, t)
}

// ---------------------------------------------------------------- elemental auras
// Each tower visibly radiates its element — the power you paid for, on show.

function drawElementAura(ctx, tower, t) {
  const el = TOWER_TYPES[tower.kind].element
  const { x, y } = tower
  if (el === 'physical') {
    // silver glints orbiting the mount, glinting when ready to fire
    for (let i = 0; i < 2; i++) {
      const a = t * 1.1 + i * Math.PI
      const gx = x + Math.cos(a) * 17
      const gy = y - 14 + Math.sin(a) * 8
      ctx.globalAlpha = 0.5 + Math.sin(t * 6 + i * 2) * 0.3
      ctx.strokeStyle = '#eef6fa'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(gx - 3, gy)
      ctx.lineTo(gx + 3, gy)
      ctx.moveTo(gx, gy - 3)
      ctx.lineTo(gx, gy + 3)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  } else if (el === 'ice') {
    // pale mist pooling at the base + snowflakes drifting down around it
    ctx.globalAlpha = 0.16 + Math.sin(t * 1.2) * 0.05
    ctx.fillStyle = '#bfe9ff'
    ctx.beginPath()
    ctx.ellipse(x, y + 2, 22, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    for (let i = 0; i < 6; i++) {
      const cycle = (t * 14 + i * 22) % 40
      const sx = x + Math.sin(i * 2.4 + t * 0.7) * 16
      const sy = y - 26 + cycle
      ctx.globalAlpha = Math.max(0, 0.7 - cycle / 40)
      ctx.fillStyle = '#e8f7ff'
      // little 6-point flake
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI
        ctx.beginPath()
        ctx.moveTo(sx - Math.cos(a) * 2.2, sy - Math.sin(a) * 2.2)
        ctx.lineTo(sx + Math.cos(a) * 2.2, sy + Math.sin(a) * 2.2)
        ctx.stroke()
      }
    }
    ctx.strokeStyle = 'rgba(232,247,255,0.7)'
    ctx.lineWidth = 1
    ctx.globalAlpha = 1
  } else if (el === 'water') {
    // ripples expanding across the pedestal + droplets sliding off
    for (let i = 0; i < 2; i++) {
      const cycle = ((t * 0.6 + i * 0.5) % 1)
      ctx.globalAlpha = 0.4 * (1 - cycle)
      ctx.strokeStyle = '#8fd8ff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(x, y + 3, 8 + cycle * 18, 5 + cycle * 11, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let i = 0; i < 4; i++) {
      const a = t * 1.5 + i * Math.PI / 2
      const dx = x + Math.cos(a) * 19
      const dy = y - 10 + Math.sin(a) * 9
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#bfe9ff'
      ctx.beginPath()
      ctx.arc(dx, dy + Math.sin(t * 3 + i) * 1.5, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (el === 'lightning') {
    // crackling arcs dancing around the obelisk
    if (Math.random() < 0.3) {
      const a = Math.random() * Math.PI * 2
      const cx = x + Math.cos(a) * 15
      const cy = y - 20 + Math.sin(a) * 12
      ctx.strokeStyle = 'rgba(199,240,255,0.85)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cx, cy - 6)
      ctx.lineTo(cx + (Math.random() - 0.5) * 8, cy - 2)
      ctx.lineTo(cx + (Math.random() - 0.5) * 10, cy + 3)
      ctx.lineTo(cx + (Math.random() - 0.5) * 6, cy + 7)
      ctx.stroke()
    }
    fakeGlow(ctx, x, y - 24, 18, 'rgba(199,240,255,0.35)', 0.18 + Math.random() * 0.1)
  }
}

// Harpoon Turret — polished bronze swivel gun on a column mount.
function drawHarpoon(ctx, tower, scale, t) {
  const recoil = Math.max(0, 1 - tower.fireFlash * 10)
  const { x, y } = tower

  // column mount
  ctx.fillStyle = '#23434f'
  ctx.beginPath()
  ctx.roundRect(x - 5 * scale, y - 8 * scale, 10 * scale, 12 * scale, 3)
  ctx.fill()
  ctx.fillStyle = '#33596a'
  ctx.beginPath()
  ctx.roundRect(x - 4 * scale, y - 8 * scale, 8 * scale, 4 * scale, 2)
  ctx.fill()

  ctx.save()
  ctx.translate(x, y - 8 * scale)
  ctx.rotate(tower.angle)
  ctx.translate(-recoil * 3.5, 0)

  // curved yoke arms
  ctx.strokeStyle = '#8d6b3f'
  ctx.lineWidth = 2.4 * scale
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(4 * scale, 0, 6.5 * scale, -Math.PI * 0.62, Math.PI * 0.62)
  ctx.stroke()
  // gun body: two-tone bronze, dark under / light over
  ctx.fillStyle = '#7a5c34'
  ctx.beginPath()
  ctx.roundRect(-4 * scale, -3.4 * scale, 11 * scale, 6.8 * scale, 2.5)
  ctx.fill()
  ctx.fillStyle = '#9c7845'
  ctx.beginPath()
  ctx.roundRect(-4 * scale, -3.4 * scale, 11 * scale, 3.4 * scale, 2)
  ctx.fill()
  // barrel: slender steel with shine
  ctx.fillStyle = '#3e4a52'
  ctx.fillRect(6 * scale, -1.9 * scale, 10 * scale, 3.8 * scale)
  ctx.fillStyle = '#6b7d87'
  ctx.fillRect(6 * scale, -1.9 * scale, 10 * scale, 1.5 * scale)
  // gold muzzle ring
  ctx.fillStyle = GOLD
  ctx.fillRect(14.5 * scale, -2.4 * scale, 2 * scale, 4.8 * scale)
  // elegant spear: slim shaft, swept barbs, needle tip
  ctx.strokeStyle = '#dfe9ee'
  ctx.lineWidth = 1.7 * scale
  ctx.beginPath()
  ctx.moveTo(15 * scale, 0)
  ctx.lineTo(24 * scale, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(24 * scale, 0)
  ctx.quadraticCurveTo(20.5 * scale, -3.2 * scale, 17 * scale, -2.6 * scale)
  ctx.moveTo(24 * scale, 0)
  ctx.quadraticCurveTo(20.5 * scale, 3.2 * scale, 17 * scale, 2.6 * scale)
  ctx.stroke()
  ctx.fillStyle = '#f4f8fa'
  ctx.beginPath()
  ctx.moveTo(24 * scale, 0)
  ctx.lineTo(29 * scale, 0)
  ctx.lineTo(24 * scale, -1.4 * scale)
  ctx.lineTo(24 * scale, 1.4 * scale)
  ctx.closePath()
  ctx.fill()
  // tension line trailing back
  ctx.strokeStyle = 'rgba(223,233,238,0.35)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(16 * scale, 0)
  ctx.quadraticCurveTo(6 * scale, 9 + Math.sin(t * 2.4) * 3, -9, 8)
  ctx.stroke()
  ctx.restore()

  if (tower.fireFlash < 0.1) fakeGlow(ctx, x, y - 8 * scale, 20 * scale, 'rgba(255,240,210,0.4)')
}

// Frost Coral — pale ice crystal grove: faceted main crystal, curving
// frosted branches with diamond tips, slow-orbiting ice shards.
function drawFrost(ctx, tower, scale, t) {
  const { x, y } = tower
  const sway = t * 1.1

  // central faceted ice crystal
  const ch = 15 * scale
  const lean = Math.sin(t * 0.9) * 0.06
  ctx.save()
  ctx.translate(x, y - 2)
  ctx.rotate(lean)
  ctx.fillStyle = '#9cc9e8'
  ctx.beginPath()
  ctx.moveTo(0, -ch)
  ctx.lineTo(5 * scale, -2)
  ctx.lineTo(0, 3)
  ctx.lineTo(-5 * scale, -2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#d6efff'
  ctx.beginPath()
  ctx.moveTo(0, -ch)
  ctx.lineTo(2.4 * scale, -2)
  ctx.lineTo(0, 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // curving branches with diamond tips
  ctx.strokeStyle = '#7fc4e8'
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue // center occupied by the crystal
    const a = -Math.PI / 2 + (i - 2) * 0.48
    const len = (9 + rnd(i * 9) * 4) * scale
    const swayA = a + Math.sin(sway + i * 1.3) * 0.14
    const midX = x + Math.cos(a + Math.sin(sway + i) * 0.06) * len * 0.5
    const midY = y + Math.sin(a + Math.sin(sway + i) * 0.06) * len * 0.5
    const tipX = x + Math.cos(swayA) * len
    const tipY = y + Math.sin(swayA) * len
    ctx.lineWidth = 2.6 * scale
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(midX, midY, tipX, tipY)
    ctx.stroke()
    // diamond crystal tip
    const tw = 2.6 * scale
    ctx.fillStyle = '#c6ecff'
    ctx.beginPath()
    ctx.moveTo(tipX, tipY - tw * 1.6)
    ctx.lineTo(tipX + tw, tipY)
    ctx.lineTo(tipX, tipY + tw * 1.2)
    ctx.lineTo(tipX - tw, tipY)
    ctx.closePath()
    ctx.fill()
  }

  // orbiting ice shards
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + (i / 3) * Math.PI * 2
    const sx = x + Math.cos(a) * 13 * scale
    const sy = y - 8 * scale + Math.sin(a) * 6 * scale
    ctx.globalAlpha = 0.65 + Math.sin(t * 3 + i * 2) * 0.25
    ctx.fillStyle = '#e8f7ff'
    ctx.beginPath()
    ctx.moveTo(sx, sy - 3)
    ctx.lineTo(sx + 1.8, sy)
    ctx.lineTo(sx, sy + 3)
    ctx.lineTo(sx - 1.8, sy)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const glow = tower.fireFlash < 0.25 ? 0.45 : 0.13 + Math.sin(t * 1.8) * 0.04
  fakeGlow(ctx, x, y - 7 * scale, 16 * scale, 'rgba(159,216,255,0.5)', glow)
}

// Tide Battery — heavy brass mortar on a dark-wood carriage with brass inlay.
function drawBattery(ctx, tower, scale, t) {
  const recoil = Math.max(0, 1 - tower.fireFlash * 8)
  const { x, y } = tower

  ctx.save()
  ctx.translate(x, y - 2)
  ctx.rotate(tower.angle)
  ctx.translate(-recoil * 4, 0)

  // carriage: dark wood wedge with brass inlay stripe
  ctx.fillStyle = '#4a3a26'
  ctx.beginPath()
  ctx.moveTo(-9 * scale, 6 * scale)
  ctx.lineTo(-6 * scale, -6 * scale)
  ctx.lineTo(2 * scale, -6 * scale)
  ctx.lineTo(4 * scale, 6 * scale)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = GOLD_DARK
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-8 * scale, 4 * scale)
  ctx.lineTo(3 * scale, 4 * scale)
  ctx.stroke()

  // barrel: fat brass tube, breech ring, wide muzzle
  ctx.fillStyle = '#8f7340'
  ctx.beginPath()
  ctx.roundRect(-3 * scale, -6 * scale, 16 * scale, 12 * scale, 4)
  ctx.fill()
  ctx.fillStyle = '#b5955c'
  ctx.beginPath()
  ctx.roundRect(-3 * scale, -6 * scale, 16 * scale, 5.5 * scale, 3)
  ctx.fill()
  // gold bands
  ctx.fillStyle = GOLD
  ctx.fillRect(0, -6.4 * scale, 1.8 * scale, 12.8 * scale)
  ctx.fillRect(6 * scale, -6.4 * scale, 1.8 * scale, 12.8 * scale)
  // wide muzzle with dark bore
  ctx.fillStyle = '#d4b477'
  ctx.beginPath()
  ctx.roundRect(12.5 * scale, -7 * scale, 3.5 * scale, 14 * scale, 2)
  ctx.fill()
  ctx.fillStyle = '#2a2013'
  ctx.beginPath()
  ctx.ellipse(14.5 * scale, 0, 1.6 * scale, 5.2 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  // rivets
  ctx.fillStyle = GOLD_DARK
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(2 + i * 5 * scale, 5.6 * scale, 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // muzzle flash + smoke just after firing
  if (tower.fireFlash < 0.4) {
    const age = tower.fireFlash / 0.4
    if (age < 0.3) {
      const fx = x + Math.cos(tower.angle) * 17 * scale
      const fy = y - 2 + Math.sin(tower.angle) * 17 * scale
      fakeGlow(ctx, fx, fy, 10 * scale, 'rgba(255,230,160,0.5)', 0.7 * (1 - age / 0.3))
    }
    for (let i = 0; i < 3; i++) {
      const px = x + Math.cos(tower.angle) * (18 + i * 4 + age * 10)
      const py = y - 2 + Math.sin(tower.angle) * (18 + i * 4 + age * 10) + Math.sin(t * 6 + i) * 2 - age * 6
      ctx.globalAlpha = 0.3 * (1 - age)
      ctx.fillStyle = '#dfe9ee'
      ctx.beginPath()
      ctx.arc(px, py, (2 + i) * (1 + age), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

// Storm Spire — arcane crystal obelisk floating over a gold collar,
// ringed by three orbiting shards.
function drawSpire(ctx, tower, scale, t) {
  const { x, y } = tower
  const h = 27 * scale
  const bob = Math.sin(t * 1.5) * 1.5

  // gold collar on the pedestal
  ctx.fillStyle = GOLD_DARK
  ctx.beginPath()
  ctx.ellipse(x, y - 1, 8 * scale, 4 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x, y - 1.6, 8 * scale, 3.6 * scale, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(x, y - 4 * scale + bob)

  // main obelisk: 3 visible facets
  ctx.fillStyle = '#4d5cc4'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(9 * scale, -h * 0.25)
  ctx.lineTo(0, 0)
  ctx.lineTo(-9 * scale, -h * 0.25)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8290ec'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(9 * scale, -h * 0.25)
  ctx.lineTo(3 * scale, -h * 0.1)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#c9d4ff'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(3 * scale, -h * 0.5)
  ctx.lineTo(1.5 * scale, -h * 0.12)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()

  // inner lightning flicker
  if (Math.sin(t * 7 + tower.id) > 0.55) {
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#e6f0ff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -h * 0.85)
    ctx.lineTo(1.5 * scale, -h * 0.6)
    ctx.lineTo(-1.5 * scale, -h * 0.35)
    ctx.lineTo(1 * scale, -h * 0.15)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // orbiting shards ring
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + (i / 3) * Math.PI * 2
    const mx = Math.cos(a) * 13 * scale
    const my = -h * 0.4 + Math.sin(a) * 8 * scale
    ctx.fillStyle = '#aebcff'
    ctx.beginPath()
    ctx.moveTo(mx, my - 4)
    ctx.lineTo(mx + 2.2, my)
    ctx.lineTo(mx, my + 4)
    ctx.lineTo(mx - 2.2, my)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.beginPath()
    ctx.moveTo(mx, my - 4)
    ctx.lineTo(mx + 2.2, my)
    ctx.lineTo(mx, my)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  const glow = tower.fireFlash < 0.2 ? 0.5 : 0.15 + Math.sin(t * 2.4) * 0.06
  fakeGlow(ctx, x, y - 4 * scale - h * 0.45, 16 * scale, 'rgba(199,240,255,0.6)', glow)
}

function drawLevelPips(ctx, tower, t = 0) {
  const n = tower.level - 1
  if (n <= 0) return
  for (let i = 0; i < n; i++) {
    const px = tower.x - 6 + i * 12
    const py = tower.y + 20
    ctx.globalAlpha = 0.5 + Math.sin(t * 3 + i * 2) * 0.3
    fakeGlow(ctx, px, py, 4, 'rgba(255,215,107,0.4)')
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.arc(px, py, 2.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = GOLD_DARK
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- ghost / placement

function drawGhost(ctx, g, t) {
  const { col, row } = g.hover
  const x = col * TILE + TILE / 2
  const y = row * TILE + TILE / 2
  const type = TOWER_TYPES[g.placing]
  const valid = isBuildableTile(col, row) && !g.occupied.has(`${col},${row}`) && g.gold >= type.cost
  const color = valid ? '#7ee8d0' : '#ff7a6b'

  // tile cell highlight
  ctx.fillStyle = valid ? 'rgba(126,232,208,0.12)' : 'rgba(255,122,107,0.15)'
  ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2)

  ctx.globalAlpha = 0.13
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, type.range, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.7
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 8])
  ctx.lineDashOffset = -t * 26
  ctx.beginPath()
  ctx.arc(x, y, type.range, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  ctx.globalAlpha = 0.65
  ctx.fillStyle = valid ? '#3f6b78' : '#7a4040'
  ctx.beginPath()
  ctx.ellipse(x, y, 13, 11, 0, 0, Math.PI * 2)
  ctx.fill()
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
  const heading = pointAt(e.dist).angle
  const wag = Math.sin(t * 10 + e.id * 2)
  // scale art with the configured radius (old art was built for these bases)
  const BASE = { minnow: 9, dart: 7, shoal: 11, fry: 5, brute: 13, maw: 18 }
  const s = e.radius / (BASE[e.kind] || 9)

  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(heading)
  ctx.scale(s, s)

  switch (e.kind) {
    case 'minnow':
      drawFish(ctx, 10, '#8fd0c2', '#5fa899', wag, t, e.id, true)
      break
    case 'fry':
      drawFish(ctx, 6, '#a9d6c8', '#7cb3a4', wag * 1.3, t, e.id, false)
      break
    case 'dart':
      drawDart(ctx, wag, t, e.id)
      break
    case 'shoal':
      drawShoal(ctx, wag, t, e.id)
      break
    case 'brute':
      drawBrute(ctx, wag, t, e.id)
      break
    case 'maw':
      drawMaw(ctx, t, e.id)
      break
  }
  ctx.restore()

  // slow indicator: frosty sheen + orbiting crystals
  if (e.slowUntil > t) {
    ctx.globalAlpha = 0.3 + Math.sin(t * 8) * 0.1
    ctx.fillStyle = '#9fd8ff'
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.7
    ctx.fillStyle = '#e6f7ff'
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i / 3) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(e.x + Math.cos(a) * (e.radius + 3), e.y + Math.sin(a) * (e.radius + 3), 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // wet indicator: glossy droplets (amplifies lightning damage)
  if (e.wetUntil > t) {
    ctx.globalAlpha = 0.45
    ctx.fillStyle = '#3aa6d8'
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius + 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.8
    ctx.fillStyle = '#bfe9ff'
    for (let i = 0; i < 2; i++) {
      const wob = Math.sin(t * 6 + i * 3 + e.id) * 2
      ctx.beginPath()
      ctx.arc(e.x + wob, e.y - e.radius - 2 + i * 4, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // stunned: dizzy sparks
  if (e.stunUntil > t) {
    ctx.fillStyle = '#fff2a8'
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + (i / 3) * Math.PI * 2
      const sx = e.x + Math.cos(a) * (e.radius + 5)
      const sy = e.y - e.radius - 4 + Math.sin(a) * 3
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // hp bar when damaged
  if (e.hp < e.maxHp) {
    const w = e.boss ? 48 : 26
    const frac = Math.max(0, e.hp / e.maxHp)
    const by = e.y - e.radius - 10
    ctx.fillStyle = 'rgba(8,20,28,0.75)'
    ctx.beginPath()
    ctx.roundRect(e.x - w / 2, by, w, 4.5, 2)
    ctx.fill()
    ctx.fillStyle = e.boss ? '#b84fd0' : frac > 0.5 ? '#7ee8d0' : '#ff7a6b'
    ctx.beginPath()
    ctx.roundRect(e.x - w / 2, by, Math.max(2, w * frac), 4.5, 2)
    ctx.fill()
  }
}

// Generic fish: volume-shaded body (lit top / shadowed belly), wagging tail,
// fluttering pectoral fin, dorsal fin, gill line, glinting eye. Facing +x.
function drawFish(ctx, size, body, belly, wag, t, id, fancy) {
  // contact shadow drifting under the body
  groundShadow(ctx, 0, size * 0.95, size * 0.85, size * 0.28, 0.18)

  // tail fin
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(-size * 0.75, 0)
  ctx.quadraticCurveTo(
    -size * 1.15,
    (-0.45 + wag * 0.12) * size,
    -size * (1.35 + wag * 0.06),
    wag * 0.22 * size,
  )
  ctx.quadraticCurveTo(
    -size * 1.15,
    (0.45 + wag * 0.12) * size,
    -size * 0.75,
    0,
  )
  ctx.fill()

  // dorsal fin
  ctx.beginPath()
  ctx.moveTo(-size * 0.3, -size * 0.42)
  ctx.quadraticCurveTo(0, -size * 0.85, size * 0.25, -size * 0.4)
  ctx.closePath()
  ctx.fill()

  // body: volume gradient — light above, shade below
  ctx.fillStyle = volGrad(ctx, 0, 0, size * 0.6, body)
  ctx.beginPath()
  ctx.ellipse(0, 0, size, size * 0.52, 0, 0, Math.PI * 2)
  ctx.fill()
  // belly
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(size * 0.05, size * 0.16, size * 0.7, size * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()
  // top rim light
  rimLight(ctx, 0, -size * 0.05, size * 0.9, size * 0.4, 'rgba(255,255,255,0.35)')

  if (fancy) {
    // scale shimmer
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 0.8
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.arc(i * size * 0.3, 0, size * 0.3, -0.6, 0.6)
      ctx.stroke()
    }
  }

  // pectoral fin fluttering
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.moveTo(size * 0.1, size * 0.2)
  ctx.quadraticCurveTo(
    size * 0.25,
    size * 0.55 + Math.sin(t * 14 + id) * size * 0.15,
    size * 0.4,
    size * 0.3,
  )
  ctx.closePath()
  ctx.fill()

  // gill line
  ctx.strokeStyle = 'rgba(10,35,45,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(size * 0.35, 0, size * 0.3, -1.1, 1.1)
  ctx.stroke()

  // eye
  ctx.fillStyle = '#0b2028'
  ctx.beginPath()
  ctx.arc(size * 0.55, -size * 0.12, Math.max(1.1, size * 0.13), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(size * 0.59, -size * 0.16, Math.max(0.4, size * 0.05), 0, Math.PI * 2)
  ctx.fill()
}

function drawDart(ctx, wag, t, id) {
  // speed streaks
  ctx.strokeStyle = 'rgba(255,215,107,0.3)'
  ctx.lineWidth = 1
  for (let i = 0; i < 2; i++) {
    ctx.beginPath()
    ctx.moveTo(-14 - i * 4, -2 + i * 3)
    ctx.lineTo(-26 - i * 6, -2 + i * 3)
    ctx.stroke()
  }
  // swept crest fin — cuts through water
  ctx.fillStyle = '#e8a94a'
  ctx.beginPath()
  ctx.moveTo(-2, -3)
  ctx.quadraticCurveTo(4, -11, 8, -4)
  ctx.closePath()
  ctx.fill()
  drawFish(ctx, 8.5, '#ffd76b', '#e8a94a', wag * 0.7, t, id, false)
}

function drawShoal(ctx, wag, t, id) {
  // pulsing sac glow — the fry inside
  const pulse = 0.5 + Math.sin(t * 5 + id) * 0.2
  ctx.globalAlpha = pulse * 0.5
  ctx.fillStyle = '#f2d9f5'
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  drawFish(ctx, 12, '#c98fd0', '#a56cb2', wag * 0.5, t, id, true)
  // fry silhouettes inside
  ctx.fillStyle = 'rgba(250,240,252,0.8)'
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + (i / 3) * Math.PI * 2
    ctx.beginPath()
    ctx.ellipse(
      Math.cos(a) * 4,
      Math.sin(a) * 3,
      2.4,
      1.2,
      a,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
}

// Armored turtle-brute: domed plated shell, rowing flippers, blinking eyes.
function drawBrute(ctx, wag, t, id) {
  groundShadow(ctx, 0, 9, 20, 8, 0.3)
  // flippers rowing
  ctx.fillStyle = '#4c683e'
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1
    const fx = i % 2 === 0 ? -6 : 7
    const row = Math.sin(t * 5 + i * 1.6) * 3
    ctx.beginPath()
    ctx.ellipse(fx, side * (12 + row), 6, 3.2, side * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  // spiked shell rim
  ctx.fillStyle = '#40573a'
  ctx.beginPath()
  ctx.ellipse(0, 0, 15, 12.5, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a - 0.18) * 13, Math.sin(a - 0.18) * 11)
    ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 15)
    ctx.lineTo(Math.cos(a + 0.18) * 13, Math.sin(a + 0.18) * 11)
    ctx.closePath()
    ctx.fill()
  }
  // dome: volume gradient — lit crown, shaded skirt
  ctx.fillStyle = volGrad(ctx, 0, -4, 12, '#7a9a5f')
  ctx.beginPath()
  ctx.ellipse(0, -1, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  rimLight(ctx, 0, -3, 11, 8.5, 'rgba(230,255,210,0.4)')
  // shell plates
  ctx.strokeStyle = 'rgba(45,62,38,0.7)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(0, -1, 8, 6.5, 0, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.15
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 8, -1 + Math.sin(a) * 6.5)
    ctx.lineTo(Math.cos(a) * 11.5, -1 + Math.sin(a) * 9.5)
    ctx.stroke()
  }
  // head bump + horn crest + eyes that blink
  ctx.fillStyle = '#5a7a4a'
  ctx.beginPath()
  ctx.ellipse(13, 0, 5.5, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d8cf9a'
  for (const hy of [-3.5, 0, 3.5]) {
    ctx.beginPath()
    ctx.moveTo(15, hy - 1.5)
    ctx.lineTo(21, hy)
    ctx.lineTo(15, hy + 1.5)
    ctx.closePath()
    ctx.fill()
  }
  const blink = Math.sin(t * 0.9 + id * 3) > 0.96 ? 0.15 : 1
  ctx.fillStyle = '#1d2b1a'
  ctx.beginPath()
  ctx.ellipse(14.5, -1.8, 1.6, 1.6 * blink, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(14.5, 1.8, 1.6, 1.6 * blink, 0, 0, Math.PI * 2)
  ctx.fill()
}

// The Maw: abyssal anglerfish — hulking body, snapping jaw with teeth,
// glowing lure, ghostly eyes. Drawn facing +x, roughly 20px radius.
function drawMaw(ctx, t, id) {
  const chomp = 0.25 + Math.abs(Math.sin(t * 2.2 + id)) * 0.45
  const lureSwing = Math.sin(t * 1.8 + id) * 3

  groundShadow(ctx, 0, 16, 30, 11, 0.35)

  // aura
  ctx.globalAlpha = 0.2 + Math.sin(t * 3) * 0.08
  ctx.fillStyle = '#b84fd0'
  ctx.beginPath()
  ctx.arc(0, 0, 30, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // tail fin
  ctx.fillStyle = '#4a2060'
  ctx.beginPath()
  ctx.moveTo(-14, 0)
  ctx.quadraticCurveTo(-24, -10 + Math.sin(t * 4) * 3, -30, Math.sin(t * 4) * 4)
  ctx.quadraticCurveTo(-24, 10 + Math.sin(t * 4) * 3, -14, 0)
  ctx.fill()

  // dorsal spikes
  ctx.fillStyle = '#3a1850'
  for (let i = 0; i < 4; i++) {
    const sx = -8 + i * 6
    ctx.beginPath()
    ctx.moveTo(sx - 2.5, -9)
    ctx.lineTo(sx, -17 - Math.sin(t * 3 + i) * 1.5)
    ctx.lineTo(sx + 2.5, -9)
    ctx.closePath()
    ctx.fill()
  }

  // side fins, slowly rowing
  ctx.fillStyle = '#4a2060'
  for (const side of [-1, 1]) {
    const flap = Math.sin(t * 2.6 + side) * 0.35
    ctx.save()
    ctx.translate(-4, side * 10)
    ctx.rotate(side * 0.9 + flap * side)
    ctx.beginPath()
    ctx.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // body: volume-shaded hulk
  ctx.fillStyle = volGrad(ctx, 0, -2, 17, '#6e2f86', 0.3)
  ctx.beginPath()
  ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = shade('#8b3ea6', 0.1)
  ctx.beginPath()
  ctx.ellipse(-2, -3, 14, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  rimLight(ctx, -2, -5, 13, 8, 'rgba(230,200,255,0.45)')
  // skin speckles
  ctx.fillStyle = 'rgba(240,220,255,0.25)'
  for (let i = 0; i < 5; i++) {
    const px = -12 + rnd(i * 7) * 22
    const py = -8 + rnd(i * 3) * 14
    ctx.beginPath()
    ctx.arc(px, py, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }

  // jaw: dark maw that opens/closes
  ctx.fillStyle = '#2b0d3a'
  ctx.beginPath()
  ctx.ellipse(9, 2, 10, 11 * chomp + 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // throat glow
  ctx.globalAlpha = 0.4
  ctx.fillStyle = '#c86bff'
  ctx.beginPath()
  ctx.ellipse(11, 2, 5, 6 * chomp, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // teeth along the jaw
  ctx.fillStyle = '#f4ecff'
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.3 + (i / 5) * Math.PI * 0.75
    const tx = 9 + Math.cos(a) * 9.5
    const ty = 2 + Math.sin(a) * (10 * chomp + 1)
    ctx.beginPath()
    ctx.moveTo(tx - 2, ty - 3.5)
    ctx.lineTo(tx + 2, ty - 3.5)
    ctx.lineTo(tx, ty + 2.5)
    ctx.closePath()
    ctx.fill()
  }

  // eyes
  const eyeGlow = 0.7 + Math.sin(t * 2.6) * 0.3
  ctx.globalAlpha = eyeGlow
  ctx.fillStyle = '#ffd76b'
  ctx.beginPath()
  ctx.arc(-4, -8, 3.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(5, -9, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a0a24'
  ctx.beginPath()
  ctx.arc(-4, -8, 1.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(5, -9, 1.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // anglerfish lure: arcing stalk + glowing bulb
  ctx.strokeStyle = '#4a2060'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-2, -13)
  ctx.quadraticCurveTo(6, -26, 16, -20 + lureSwing)
  ctx.stroke()
  const lx = 16
  const ly = -20 + lureSwing
  fakeGlow(ctx, lx, ly, 9, 'rgba(180,120,255,0.4)', 0.6 + Math.sin(t * 6) * 0.3)
  ctx.fillStyle = '#e2c7ff'
  ctx.beginPath()
  ctx.arc(lx, ly, 2.8, 0, Math.PI * 2)
  ctx.fill()
}

// ---------------------------------------------------------------- projectiles

function drawProjectile(ctx, p) {
  const arc = Math.sin(Math.min(1, p.t / p.flight) * Math.PI) * 22
  // ground shadow
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#04141d'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  // water trail
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.18 - i * 0.05
    ctx.fillStyle = '#8fd8ff'
    ctx.beginPath()
    ctx.arc(p.x - i * 3.2, p.y - arc + i * 2.2, 3 - i * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  fakeGlow(ctx, p.x, p.y - arc, 7, 'rgba(143,216,255,0.45)')
  ctx.fillStyle = '#8fd8ff'
  ctx.beginPath()
  ctx.arc(p.x, p.y - arc, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e6f7ff'
  ctx.beginPath()
  ctx.arc(p.x - 1, p.y - arc - 1, 1.4, 0, Math.PI * 2)
  ctx.fill()
}

// ---------------------------------------------------------------- effects

function drawEffects(ctx, g) {
  for (const fx of g.effects) {
    const age = (g.t - fx.t0) / fx.life
    if (age < 0 || age > 1) continue
    switch (fx.kind) {
      case 'boom': {
        // flash core + expanding shockwave ring
        ctx.globalAlpha = 0.5 * (1 - age)
        ctx.fillStyle = fx.color
        ctx.beginPath()
        ctx.arc(fx.x, fx.y, fx.r * 0.5 * (0.4 + age * 0.7), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 0.8 * (1 - age)
        ctx.strokeStyle = '#fff2d0'
        ctx.lineWidth = 2.5 * (1 - age) + 0.5
        ctx.beginPath()
        ctx.arc(fx.x, fx.y, fx.r * (0.5 + age * 0.8), 0, Math.PI * 2)
        ctx.stroke()
        // sparks
        ctx.fillStyle = fx.color
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + fx.t0
          const d = fx.r * (0.4 + age)
          ctx.globalAlpha = 0.7 * (1 - age)
          ctx.beginPath()
          ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 1.8 * (1 - age), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        break
      }
      case 'ring': {
        ctx.globalAlpha = 0.6 * (1 - age)
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 2.5 * (1 - age) + 0.5
        ctx.beginPath()
        ctx.arc(fx.x, fx.y, (fx.r || 20) * (0.3 + age), 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
      case 'harpoon': {
        ctx.globalAlpha = 1 - age
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(fx.x, fx.y)
        ctx.lineTo(fx.x2, fx.y2)
        ctx.stroke()
        // impact sparkle
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(fx.x2, fx.y2, 2.5 * (1 - age), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        break
      }
      case 'bolt': {
        // double-stroke lightning: soft outer + bright inner, jagged
        const pts = fx.pts
        for (let pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = (1 - age) * (pass === 0 ? 0.35 : 0.9)
          ctx.strokeStyle = pass === 0 ? '#8fd0ff' : fx.color
          ctx.lineWidth = pass === 0 ? 4.5 : 1.8
          ctx.lineJoin = 'round'
          ctx.beginPath()
          for (let i = 0; i < pts.length; i++) {
            const jitter = i > 0 && i < pts.length - 1 ? 4 : 0
            const px = pts[i][0] + (jitter ? (Math.random() - 0.5) * jitter * 2 : 0)
            const py = pts[i][1] + (jitter ? (Math.random() - 0.5) * jitter * 2 : 0)
            if (i === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        break
      }
      case 'hit': {
        // bubble burst
        for (let i = 0; i < 5; i++) {
          const a = rnd(i * 3 + fx.t0 * 10) * Math.PI * 2
          const d = (fx.r || 10) * (0.3 + age * 0.9)
          ctx.globalAlpha = 0.7 * (1 - age)
          ctx.strokeStyle = fx.color
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d, 2.5 * (1 - age * 0.6), 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        break
      }
      case 'leak': {
        ctx.globalAlpha = 0.8 * (1 - age)
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 3 * (1 - age) + 0.5
        ctx.beginPath()
        ctx.arc(fx.x, fx.y, (fx.r || 20) * (0.5 + age), 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = fx.color
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + fx.t0 * 7
          ctx.globalAlpha = 0.6 * (1 - age)
          ctx.beginPath()
          ctx.arc(fx.x + Math.cos(a) * age * 24, fx.y + Math.sin(a) * age * 24, 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        break
      }
    }
  }
}

// ---------------------------------------------------------------- helpers & finish

function fakeGlow(ctx, x, y, r, color, alpha = 0.3) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(
    BOARD.w / 2,
    BOARD.h / 2,
    BOARD.h * 0.45,
    BOARD.w / 2,
    BOARD.h / 2,
    BOARD.w * 0.72,
  )
  grad.addColorStop(0, 'rgba(4,16,24,0)')
  grad.addColorStop(1, 'rgba(4,16,24,0.4)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, BOARD.w, BOARD.h)
}

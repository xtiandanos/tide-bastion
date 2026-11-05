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
      drawLevelPips(ctx, sel)
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

function drawTower(ctx, tower, t) {
  const { x, y, kind, level, fireFlash } = tower
  const scale = 1 + (level - 1) * 0.08

  // base pad + plank ring
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(8,24,32,0.5)'
  ctx.beginPath()
  ctx.ellipse(0, 4, 16 * scale, 11 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2e5261'
  ctx.beginPath()
  ctx.ellipse(0, 1, 15 * scale, 12 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(10,26,34,0.55)'
  ctx.lineWidth = 1
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.ellipse(0, i * 5, 14 * scale, 3.4, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  if (kind === 'harpoon') drawHarpoon(ctx, tower, scale, t)
  else if (kind === 'frost') drawFrost(ctx, tower, scale, t)
  else if (kind === 'battery') drawBattery(ctx, tower, scale, t)
  else if (kind === 'spire') drawSpire(ctx, tower, scale, t)

  drawLevelPips(ctx, tower)
}

function drawHarpoon(ctx, tower, scale, t) {
  const recoil = Math.max(0, 1 - tower.fireFlash * 10) // 1 → 0 just after firing
  ctx.save()
  ctx.translate(tower.x, tower.y)
  ctx.rotate(tower.angle)
  ctx.translate(-recoil * 3, 0)

  // yoke
  ctx.fillStyle = '#7fa6b8'
  ctx.beginPath()
  ctx.roundRect(-6 * scale, -6 * scale, 12 * scale, 12 * scale, 2)
  ctx.fill()
  // barrel
  ctx.fillStyle = '#9cc0d0'
  ctx.fillRect(2, -2.4 * scale, 10 * scale, 4.8 * scale)
  // harpoon shaft + barbs
  ctx.strokeStyle = '#dfe9ee'
  ctx.lineWidth = 2 * scale
  ctx.beginPath()
  ctx.moveTo(8, 0)
  ctx.lineTo(19 * scale, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(19 * scale, 0)
  ctx.lineTo(14 * scale, -3.4 * scale)
  ctx.moveTo(19 * scale, 0)
  ctx.lineTo(14 * scale, 3.4 * scale)
  ctx.stroke()
  // line back to turret
  ctx.strokeStyle = 'rgba(223,233,238,0.4)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(19 * scale, 0)
  ctx.quadraticCurveTo(8 * scale, Math.sin(t * 3) * 4, -8, 5)
  ctx.stroke()
  ctx.restore()

  if (tower.fireFlash < 0.1) fakeGlow(ctx, tower.x, tower.y, 19 * scale, 'rgba(223,233,238,0.35)')
}

function drawFrost(ctx, tower, scale, t) {
  const { x, y } = tower
  const sway = t * 1.1
  // rock base
  ctx.fillStyle = '#36586a'
  ctx.beginPath()
  ctx.ellipse(x, y + 4, 10 * scale, 6 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  // coral branches with sub-branches, swaying
  ctx.strokeStyle = '#7fc4e8'
  ctx.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42
    const len = (10 + rnd(i * 9) * 4) * scale
    const midX = x + Math.cos(a + Math.sin(sway + i) * 0.06) * len * 0.5
    const midY = y + Math.sin(a + Math.sin(sway + i) * 0.06) * len * 0.5
    const tipX = x + Math.cos(a + Math.sin(sway + i * 1.3) * 0.14) * len
    const tipY = y + Math.sin(a + Math.sin(sway + i * 1.3) * 0.14) * len
    ctx.lineWidth = 3 * scale
    ctx.beginPath()
    ctx.moveTo(x, y + 2)
    ctx.quadraticCurveTo(midX, midY, tipX, tipY)
    ctx.stroke()
    // sub-branch
    ctx.lineWidth = 1.8 * scale
    ctx.beginPath()
    ctx.moveTo(midX, midY)
    ctx.lineTo(midX + Math.cos(a - 0.7) * len * 0.4, midY + Math.sin(a - 0.7) * len * 0.4)
    ctx.stroke()
    // tip bulb
    ctx.fillStyle = '#aadcff'
    ctx.beginPath()
    ctx.arc(tipX, tipY, 1.6 * scale, 0, Math.PI * 2)
    ctx.fill()
  }
  // polyps: tiny glowing dots pulsing on the branches
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.42
    const d = (4 + rnd(i * 5) * 5) * scale
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    ctx.globalAlpha = 0.5 + Math.sin(t * 2.2 + i * 1.8) * 0.4
    ctx.fillStyle = '#d6f2ff'
    ctx.beginPath()
    ctx.arc(px, py, 1.2 * scale, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const glow = tower.fireFlash < 0.25 ? 0.45 : 0.14
  fakeGlow(ctx, x, y, 15 * scale, 'rgba(159,216,255,0.5)', glow)
  // idle bubbles
  if (Math.sin(t * 1.3 + tower.id) > 0.94) {
    const by = y - 16 - ((t * 12) % 14)
    ctx.strokeStyle = 'rgba(200,240,250,0.4)'
    ctx.beginPath()
    ctx.arc(x + 3, by, 1.6, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawBattery(ctx, tower, scale, t) {
  const recoil = Math.max(0, 1 - tower.fireFlash * 8)
  ctx.save()
  ctx.translate(tower.x, tower.y)
  ctx.rotate(tower.angle)
  ctx.translate(-recoil * 4, 0)
  // carriage
  ctx.fillStyle = '#8a6f42'
  ctx.beginPath()
  ctx.roundRect(-8 * scale, -5 * scale, 10 * scale, 10 * scale, 2)
  ctx.fill()
  // tube
  ctx.fillStyle = '#c9a86a'
  ctx.beginPath()
  ctx.roundRect(0, -5.5 * scale, 15 * scale, 11 * scale, 3)
  ctx.fill()
  // muzzle ring
  ctx.fillStyle = '#a98c55'
  ctx.fillRect(13 * scale, -6 * scale, 3 * scale, 12 * scale)
  // band details
  ctx.strokeStyle = 'rgba(70,50,25,0.6)'
  ctx.lineWidth = 1
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 4.5 * scale, -5 * scale)
    ctx.lineTo(i * 4.5 * scale, 5 * scale)
    ctx.stroke()
  }
  ctx.restore()

  // muzzle smoke just after firing
  if (tower.fireFlash < 0.4) {
    const age = tower.fireFlash / 0.4
    for (let i = 0; i < 3; i++) {
      const px = tower.x + Math.cos(tower.angle) * (16 + i * 4 + age * 10)
      const py = tower.y + Math.sin(tower.angle) * (16 + i * 4 + age * 10) + Math.sin(t * 6 + i) * 2 - age * 6
      ctx.globalAlpha = 0.3 * (1 - age)
      ctx.fillStyle = '#dfe9ee'
      ctx.beginPath()
      ctx.arc(px, py, (2 + i) * (1 + age), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function drawSpire(ctx, tower, scale, t) {
  const { x, y } = tower
  const h = 24 * scale
  // main crystal
  ctx.fillStyle = '#5c6cd0'
  ctx.beginPath()
  ctx.moveTo(x, y - h)
  ctx.lineTo(x + 9 * scale, y - 2)
  ctx.lineTo(x, y + 3)
  ctx.lineTo(x - 9 * scale, y - 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#9aa8ff'
  ctx.beginPath()
  ctx.moveTo(x, y - h)
  ctx.lineTo(x + 4.5 * scale, y - 2)
  ctx.lineTo(x, y + 1)
  ctx.closePath()
  ctx.fill()
  // side shards
  ctx.fillStyle = '#7484e0'
  ctx.beginPath()
  ctx.moveTo(x - 10 * scale, y + 2)
  ctx.lineTo(x - 6 * scale, y - h * 0.45)
  ctx.lineTo(x - 3 * scale, y + 2)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + 4 * scale, y + 2)
  ctx.lineTo(x + 8 * scale, y - h * 0.35)
  ctx.lineTo(x + 11 * scale, y + 2)
  ctx.closePath()
  ctx.fill()
  // inner pulse
  ctx.globalAlpha = 0.4 + Math.sin(t * 2.6) * 0.25
  ctx.fillStyle = '#dfe8ff'
  ctx.beginPath()
  ctx.moveTo(x, y - h * 0.8)
  ctx.lineTo(x + 2 * scale, y - 4)
  ctx.lineTo(x, y - 2)
  ctx.lineTo(x - 2 * scale, y - 4)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
  // orbiting motes
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + (i / 3) * Math.PI * 2
    const mx = x + Math.cos(a) * (11 * scale)
    const my = y - h * 0.5 + Math.sin(a) * (7 * scale)
    ctx.globalAlpha = 0.5 + Math.sin(t * 4 + i * 2) * 0.35
    ctx.fillStyle = '#c7f0ff'
    ctx.beginPath()
    ctx.arc(mx, my, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const glow = tower.fireFlash < 0.2 ? 0.5 : 0.16 + Math.sin(t * 2.4) * 0.06
  fakeGlow(ctx, x, y - h * 0.45, 15 * scale, 'rgba(199,240,255,0.6)', glow)
}

function drawLevelPips(ctx, tower) {
  const n = tower.level - 1
  if (n <= 0) return
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#ffd76b'
    ctx.beginPath()
    ctx.arc(tower.x - 5 + i * 10, tower.y + 19, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(90,60,10,0.6)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
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

  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.rotate(heading)

  switch (e.kind) {
    case 'minnow':
      drawFish(ctx, 10, '#8fd0c2', '#5fa899', wag, t, e.id, false)
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

  // slow indicator: frosty sheen
  if (e.slowUntil > t) {
    ctx.globalAlpha = 0.35 + Math.sin(t * 8) * 0.1
    ctx.fillStyle = '#9fd8ff'
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2)
    ctx.fill()
    // tiny crystals
    ctx.globalAlpha = 0.7
    ctx.fillStyle = '#e6f7ff'
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i / 3) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(e.x + Math.cos(a) * (e.radius + 2), e.y + Math.sin(a) * (e.radius + 2), 1.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // hp bar when damaged
  if (e.hp < e.maxHp) {
    const w = e.boss ? 40 : 22
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

// Generic fish: two-tone body, wagging tail, fluttering pectoral fin,
// dorsal fin, gill line, glinting eye. Drawn facing +x.
function drawFish(ctx, size, body, belly, wag, t, id, fancy) {
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

  // body
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(0, 0, size, size * 0.52, 0, 0, Math.PI * 2)
  ctx.fill()
  // belly
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(size * 0.05, size * 0.14, size * 0.7, size * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()

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
  // dome
  ctx.fillStyle = '#7a9a5f'
  ctx.beginPath()
  ctx.ellipse(0, -1, 12, 10, 0, 0, Math.PI * 2)
  ctx.fill()
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
  // head bump + eyes that blink
  ctx.fillStyle = '#5a7a4a'
  ctx.beginPath()
  ctx.ellipse(13, 0, 5.5, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
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

  // body
  ctx.fillStyle = '#6e2f86'
  ctx.beginPath()
  ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8b3ea6'
  ctx.beginPath()
  ctx.ellipse(-2, -3, 14, 9, 0, 0, Math.PI * 2)
  ctx.fill()
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
  // trail
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.18 - i * 0.05
    ctx.fillStyle = '#ffd28a'
    ctx.beginPath()
    ctx.arc(p.x - i * 3.2, p.y - arc + i * 2.2, 3 - i * 0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  fakeGlow(ctx, p.x, p.y - arc, 7, 'rgba(255,210,138,0.45)')
  ctx.fillStyle = '#ffd28a'
  ctx.beginPath()
  ctx.arc(p.x, p.y - arc, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff2d0'
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

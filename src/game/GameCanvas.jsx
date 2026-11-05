import { useEffect, useRef } from 'react'
import {
  BOARD,
  createGame,
  draw,
  update,
  hudSnapshot,
  placeTower,
  upgradeTower,
  sellTower,
  startWave,
  setAuto,
} from './engine'
import { TILE, TOWER_ORDER } from './config'
import { audio } from './audio'
import './game.css'

// Thin canvas shell: owns the rAF loop and raw input, reports to React only
// when the HUD snapshot actually changes. All state lives in the engine.
export default function GameCanvas({ phase, runToken, speed, apiRef, onHud, onOver, onWin }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const engineRef = useRef(null)
  const phaseRef = useRef(phase)
  const speedRef = useRef(speed)
  const onHudRef = useRef(onHud)
  const onOverRef = useRef(onOver)
  const onWinRef = useRef(onWin)

  useEffect(() => {
    phaseRef.current = phase
    speedRef.current = speed
    onHudRef.current = onHud
    onOverRef.current = onOver
    onWinRef.current = onWin
  })

  // Fresh engine per run; also expose imperative actions to the parent page.
  useEffect(() => {
    engineRef.current = createGame()
    if (apiRef) {
      apiRef.current = {
        setPlacing: (kind) => {
          const g = engineRef.current
          g.placing = g.placing === kind ? null : kind
          if (g.placing) g.selectedId = null
        },
        sendWave: () => startWave(engineRef.current),
        toggleAuto: () => {
          const g = engineRef.current
          setAuto(g, !g.auto)
        },
        upgradeSelected: () => {
          const g = engineRef.current
          const t = g.towers.find((tw) => tw.id === g.selectedId)
          if (t) upgradeTower(g, t)
        },
        sellSelected: () => {
          const g = engineRef.current
          const t = g.towers.find((tw) => tw.id === g.selectedId)
          if (t) sellTower(g, t)
        },
      }
    }
  }, [runToken, apiRef])

  // Pointer → logical board coords (canvas is CSS-scaled, so never 1:1).
  const toBoard = (evt) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const sx = rect.width / BOARD.w
    const sy = rect.height / BOARD.h
    return {
      x: (evt.clientX - rect.left) / sx,
      y: (evt.clientY - rect.top) / sy,
    }
  }

  const tileFromPoint = ({ x, y }) => ({
    col: Math.floor(x / TILE),
    row: Math.floor(y / TILE),
  })

  useEffect(() => {
    const canvas = canvasRef.current
    ctxRef.current = canvas.getContext('2d')

    const sizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = BOARD.w * dpr
      canvas.height = BOARD.h * dpr
    }
    sizeCanvas()
    window.addEventListener('resize', sizeCanvas)

    const onPointerMove = (evt) => {
      const g = engineRef.current
      if (!g) return
      const { col, row } = tileFromPoint(toBoard(evt))
      g.hover = { col, row, valid: true }
    }
    const onPointerDown = (evt) => {
      const g = engineRef.current
      if (!g || phaseRef.current !== 'playing') return
      const { col, row } = tileFromPoint(toBoard(evt))

      if (g.placing) {
        const tower = placeTower(g, g.placing, col, row)
        if (!tower) return
        // stay in placement mode so players can chain-build; re-click card to stop
        return
      }
      const hit = g.towers.find((t) => t.col === col && t.row === row)
      g.selectedId = hit ? hit.id : null
    }
    const onContextMenu = (evt) => {
      evt.preventDefault()
      const g = engineRef.current
      if (!g) return
      g.placing = null
      g.selectedId = null
    }
    const onKeyDown = (evt) => {
      const g = engineRef.current
      if (!g || phaseRef.current !== 'playing') return
      const idx = ['1', '2', '3', '4'].indexOf(evt.key)
      if (idx >= 0) {
        apiRef.current?.setPlacing(TOWER_ORDER[idx])
      } else if (evt.key === 'Escape') {
        g.placing = null
        g.selectedId = null
      }
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', sizeCanvas)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let raf
    let last = performance.now()
    let lastHud = ''

    const frame = (now) => {
      const raw = Math.min((now - last) / 1000, 0.05) // clamp tab-switch jumps
      last = now
      const g = engineRef.current
      const ctx = ctxRef.current

      if (g && ctx) {
        if (phaseRef.current === 'playing' && !g.over && !g.won) {
          update(g, raw * speedRef.current)
          // drain engine sound events → procedural audio
          if (g.sfx.length) {
            for (const name of g.sfx) audio.play(name)
            g.sfx.length = 0
          }
          const snap = JSON.stringify(hudSnapshot(g))
          if (snap !== lastHud) {
            lastHud = snap
            onHudRef.current(hudSnapshot(g))
          }
          if (g.over) onOverRef.current()
          if (g.won) onWinRef.current()
        }
        const dpr = window.devicePixelRatio || 1
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        draw(ctx, g)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={BOARD.w}
      height={BOARD.h}
      className="tb-canvas"
      role="img"
      aria-label="Tide Bastion game board"
      style={{ touchAction: 'none' }}
    />
  )
}

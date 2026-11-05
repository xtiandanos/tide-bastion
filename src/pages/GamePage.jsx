import { useRef, useState } from 'react'
import GameCanvas from '../game/GameCanvas'
import { ELEMENT_INFO, TOWER_ORDER, TOWER_TYPES } from '../game/config'

// Page-level component: owns phase + HUD state, renders the canvas,
// the HUD strip, the build/upgrade panel and the phase screens.
export default function GamePage() {
  const [phase, setPhase] = useState('menu') // menu | playing | gameover | victory
  const [runToken, setRunToken] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [hud, setHud] = useState(null)
  const apiRef = useRef({})

  const start = () => {
    setRunToken((n) => n + 1)
    setHud(null)
    setSpeed(1)
    setPhase('playing')
  }

  const cycleSpeed = () => setSpeed((s) => (s >= 5 ? 1 : s + 1))

  const placing = hud?.placing
  const sel = hud?.selected

  return (
    <div className="tb-page">
      <header className="tb-header">
        <h1>
          Tide <span>Bastion</span>
        </h1>
        {phase === 'playing' && hud && (
          <div className="tb-stats">
            <span className="tb-stat gold" title="Gold">
              {hud.gold}g
            </span>
            <span className="tb-stat">
              <span
                className="tb-hearts"
                data-crisis={hud.lives <= 5 || undefined}
                title="Heart bastion"
              >
                {'♥'.repeat(Math.min(hud.lives, 10))}
                {hud.lives > 10 ? `+${hud.lives - 10}` : ''}
              </span>
            </span>
            <span className="tb-stat" title="Wave">
              Surge {Math.max(hud.wave, 1)}/{hud.totalWaves}
            </span>
            <button
              className="tb-btn tb-send"
              disabled={hud.waveActive}
              onClick={() => apiRef.current?.sendWave()}
            >
              {hud.waveActive
                ? `Surge ${hud.wave} incoming…`
                : hud.autoCountdown != null
                  ? `Send Now (${hud.autoCountdown}s)`
                  : 'Send Next Surge'}
            </button>
            <button
              className="tb-btn tb-auto"
              data-on={hud.auto || undefined}
              onClick={() => apiRef.current?.toggleAuto()}
              title="Auto-surge: the next wave fires itself after a 3s countdown"
            >
              {hud.auto ? 'Auto ON' : 'Auto OFF'}
            </button>
            <button
              className="tb-btn tb-speed"
              data-fast={speed >= 4 || undefined}
              onClick={cycleSpeed}
              title="Game speed — click to raise, up to 5×"
            >
              ⚡ {speed}×
            </button>
          </div>
        )}
      </header>

      <GameCanvas
        phase={phase}
        runToken={runToken}
        speed={speed}
        apiRef={apiRef}
        onHud={setHud}
        onOver={() => setPhase('gameover')}
        onWin={() => setPhase('victory')}
      />

      {phase === 'playing' && (
        <div className="tb-panel">
          {TOWER_ORDER.map((kind, i) => {
            const t = TOWER_TYPES[kind]
            const active = placing === kind
            const afford = hud && hud.gold >= t.cost
            const el = ELEMENT_INFO[t.element]
            return (
              <button
                key={kind}
                className={`tb-card${active ? ' active' : ''}${afford ? '' : ' poor'}`}
                onClick={() => apiRef.current?.setPlacing(kind)}
                title={t.desc}
              >
                <span className="tb-card-key">{i + 1}</span>
                <strong>{t.name}</strong>
                <span className="tb-card-cost">
                  {t.cost}g · <em className={`tb-el tb-el-${t.element}`}>{el.icon} {el.label}</em>
                </span>
                <small>{t.desc}</small>
              </button>
            )
          })}
          {sel && (
            <div className="tb-selected">
              <strong>
                {TOWER_TYPES[sel.kind].name} · Lv{sel.level}{' '}
                <em className={`tb-el tb-el-${TOWER_TYPES[sel.kind].element}`}>
                  {ELEMENT_INFO[TOWER_TYPES[sel.kind].element].icon}
                </em>
              </strong>
              <div className="tb-selected-actions">
                {sel.upCost != null ? (
                  <button
                    className="tb-btn"
                    disabled={!sel.affordableUp}
                    onClick={() => apiRef.current?.upgradeSelected()}
                  >
                    Upgrade ({sel.upCost}g)
                  </button>
                ) : (
                  <span className="tb-maxed">Max level</span>
                )}
                <button className="tb-btn tb-sell" onClick={() => apiRef.current?.sellSelected()}>
                  Sell ({sel.sellValue}g)
                </button>
              </div>
            </div>
          )}
          {placing && <p className="tb-hint">Tap a buildable tile to place — Esc or re-click to cancel</p>}
        </div>
      )}

      {phase === 'menu' && (
        <div className="tb-screen">
          <h2>The monsters surge in on the tide.</h2>
          <p>
            Raise towers along the shallows, upgrade them, and keep the sea monsters from
            reaching your heart bastion. Survive all 10 surges to win.
          </p>
          <ul>
            <li>Click a tower card (or press 1–4), then click a buildable tile.</li>
            <li>Click a placed tower to upgrade or sell it.</li>
            <li>Right-click / Esc cancels placement.</li>
          </ul>
          <button className="tb-btn tb-start" onClick={start}>
            Defend the Bastion
          </button>
        </div>
      )}

      {phase === 'gameover' && (
        <div className="tb-screen tb-overlay">
          <h2>The bastion has fallen.</h2>
          <p>
            The tide broke through on surge {hud?.wave ?? '?'} · {hud?.kills ?? 0} monsters
            vanquished.
          </p>
          <button className="tb-btn tb-start" onClick={start}>
            Try Again
          </button>
        </div>
      )}

      {phase === 'victory' && (
        <div className="tb-screen tb-overlay">
          <h2>The bastion stands!</h2>
          <p>
            All 10 surges repelled with {hud?.lives ?? 0} hearts to spare · {hud?.kills ?? 0}{' '}
            monsters vanquished.
          </p>
          <button className="tb-btn tb-start" onClick={start}>
            Play Again
          </button>
        </div>
      )}
    </div>
  )
}

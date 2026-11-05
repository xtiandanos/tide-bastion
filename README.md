# Tide Bastion 🌊

Coastal tower defense: the sea monsters surge in on the tide — raise towers along the
shallows, upgrade them, and keep them from your heart bastion. Survive all 10 surges
to win.

Built with **React + Vite** (JSX components + TypeScript game logic), HTML5 canvas,
procedurally drawn art — no image assets, no game engine library.

## Play

- Click a tower card (or press **1–4**), then click a buildable tile to place it.
- Click a placed tower to **upgrade** (3 levels) or **sell** it.
- **Send Next Surge** starts each wave; clear wave 10 to win.
- Right-click / **Esc** cancels placement. **2× speed** toggle for the impatient.

### Towers

| Tower | Cost | Trait |
|---|---|---|
| Harpoon Turret | 60g | Cheap single-target workhorse |
| Frost Coral | 80g | Slows monsters 40% |
| Tide Battery | 110g | Splash damage |
| Storm Spire | 150g | Chain lightning to 2 extra targets |

## Develop

```bash
npm install
npm run dev     # http://localhost:5182
npm run build   # production build → dist/
npm run check   # TypeScript check (tsc --noEmit)
```

## Deploy

Pushed to GitHub → imported on Vercel (Vite preset, no config needed). All game
numbers live in `src/game/config.ts` — tune there.

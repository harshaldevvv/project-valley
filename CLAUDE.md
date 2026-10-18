# Project Valley: browser open-world zombie survival

Read before working:
- `GAME_PLAN.md` — the vision, the engine decision (three.js WebGPU, not Unity), scope, milestones, team and folder ownership.
- `docs/design/principles.md` — research-backed rules for game feel, systems and engine performance. Follow its numbers as defaults.
- `docs/design/art-bible.md` — palette, scale, triangle and frame budgets, asset naming.
- `docs/research/`: genre, engine, animation and VFX research.

## Team
Specialist subagents live in `.claude/agents/` (kept local, not published):
- `engine-builder`
- `systems-builder`
- `mechanics-builder`
- `environment-builder`
- `asset-builder`
- `narrative-designer`

The main session is the lead. It assigns work by folder ownership (see GAME_PLAN §6/§8), integrates, and verifies in the browser.

Asset requests go through `docs/pipeline/asset-requests.md`. Credits and licences go in `docs/pipeline/asset-credits.md`.

## Skills (kept local in `.claude/skills/`, not published)
- `threejs-game-director` and its siblings: gameplay, graphics, UI, debug, QA, 3D, image and audio generators.
- `three-best-practices`
- `blender-image-to-3d`

## Rules
- **Zero-cost assets (user decision, 2026-10-16):** no paid APIs (no Tripo, Gemini, ElevenLabs) for now.
  - 3D models are built in Blender from reference photos found online (prefer Wikimedia Commons, public domain, CC0).
  - Reference images are for looking at only. They live in `assets/refs/` (git-ignored) and never ship.
  - Audio: CC0 stock only (Kenney, Freesound CC0, OpenGameArt CC0, Sonniss GDC bundles). Log every file in `docs/pipeline/asset-credits.md`.
- Work milestone by milestone. Each one ends playable in the browser, with a perf report.
- All tunable numbers live in `src/content/data/`. All player-facing text lives in `src/content/text/`.
- Keep the simulation (plain data) separate from rendering, so saves and future co-op stay possible.
- Blender 5.2.2 LTS is at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (not on PATH; pass it as `BLENDER_BIN`). Run it headless: `"$BLENDER_BIN" --background --python <script> -- <args>`.

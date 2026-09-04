# Codex Handoff Todo

## Current State

- Infinite canvas has been integrated into `jurilu` as a first-pass migration.
- Canvas shell has already received a light MangaCanvas visual alignment pass.
- Entry point from episode detail is already wired:
  - [src/pages/project/EpisodeDetail.tsx](/Users/hanqian/My_/my_code/jurilu/src/pages/project/EpisodeDetail.tsx)
- Canvas route is already registered:
  - [src/App.tsx](/Users/hanqian/My_/my_code/jurilu/src/App.tsx)
- Canvas wrapper page:
  - [src/pages/project/EpisodeCanvas.tsx](/Users/hanqian/My_/my_code/jurilu/src/pages/project/EpisodeCanvas.tsx)
- Migrated canvas subsystem lives here:
  - [src/features/infinite-canvas](/Users/hanqian/My_/my_code/jurilu/src/features/infinite-canvas)
- Build passed successfully with:
  - `npm run build`

## What Was Done

- Migrated the infinite canvas codebase from:
  - `/Users/hanqian/My_/my_code/ali_flow/infinite-canvas-gg4c-webui`
- Added required runtime deps in:
  - [package.json](/Users/hanqian/My_/my_code/jurilu/package.json)
- Adapted canvas routing from standalone `/canvas/:projectId` style to episode-based route:
  - `/project/:projectId/episode/:episodeId/canvas`
- Adapted canvas persistence so each episode gets its own local canvas key:
  - `episode-${projectId}-${episodeId}`
- Adjusted canvas back navigation to return to episode detail instead of the old external project pages.
- Restyled the canvas shell, floating toolbars, minimap, and React Flow controls to use MangaCanvas warm light surfaces instead of the original dark tool theme.
- Removed the dominant blue canvas accent from key node selection states and major canvas controls, shifting the experience toward MangaCanvas warm brand tones.
- Added a shared feedback layer for the app:
  - [src/components/feedback/FeedbackProvider.tsx](/Users/hanqian/My_/my_code/jurilu/src/components/feedback/FeedbackProvider.tsx)
- Replaced browser-native `alert` / `confirm` usage in app pages with shadcn-style in-app feedback and confirmation dialogs.

## Important Notes

- This is now visually closer to MangaCanvas at the shell level, but not fully productized yet.
- `antd` is currently present mainly for the infinite canvas subsystem.
- Canvas data is still stored in its own IndexedDB model, just keyed by episode identity.
- Some node internals and canvas-side dialogs still rely on `antd` styling and need further convergence.
- Git remote has already been pushed to:
  - `git@github.com:testJuri/juri.git`

## Goal For Next Codex

Finish the productization pass so the canvas feels native to MangaCanvas, without rewriting the engine.

## Priority Tasks

### 1. Product Language Alignment

Update wording so it matches episode creation workflow.

Primary files:

- [src/features/infinite-canvas/Canvas.tsx](/Users/hanqian/My_/my_code/jurilu/src/features/infinite-canvas/Canvas.tsx)
- [src/pages/project/EpisodeDetail.tsx](/Users/hanqian/My_/my_code/jurilu/src/pages/project/EpisodeDetail.tsx)

Suggested changes:

- Header title should reflect current episode context.
- Replace generic "项目" language with "片段" or "创作画布" where appropriate.
- Remove or rename old source-project actions that do not belong in MangaCanvas.
- Keep "返回片段" behavior intact.

### 2. Interaction Simplification

Trim obviously inherited UI that is not useful in this product yet.

Candidates to review:

- API settings entry in canvas header
- Any legacy menu items that do not map to MangaCanvas
- Overly heavy imported modal/panel styling
- Remaining `antd` confirm / modal patterns inside infinite canvas, especially:
  - [src/features/infinite-canvas/Canvas.tsx](/Users/hanqian/My_/my_code/jurilu/src/features/infinite-canvas/Canvas.tsx)

Do not over-refactor the engine yet. Keep this pass UI-focused.

### 3. Episode Context Injection

If time allows, start making the canvas feel episode-aware.

Good first step:

- Read episode mock data from [src/pages/project/EpisodeDetail.tsx](/Users/hanqian/My_/my_code/jurilu/src/pages/project/EpisodeDetail.tsx)
- Use episode name/code in canvas header
- Optionally pre-seed starter nodes from storyboard data

This is optional for the first cleanup pass, but highly valuable.

## Recommended Approach

1. Keep the current canvas engine and node logic intact.
2. Prefer finishing wording, confirm/toast consistency, and episode context before deeper styling passes.
3. Only change node internals if visual inconsistency is severe.
4. Avoid deleting `antd` in this pass.
5. Re-run `npm run build` before finishing.

## Risks

- A full rewrite away from `antd` will balloon scope.
- Deep persistence refactor is not needed yet.
- Over-editing node internals may introduce regressions in generation flows.
- Mixing shadcn and `antd` dialogs in the same canvas page will keep the UX feeling inconsistent unless feedback patterns are unified.

## Definition Of Done For Next Pass

- Clicking "继续创作" still opens the canvas.
- Canvas still builds and runs.
- Header, wording, and actions feel consistent with MangaCanvas.
- No obvious browser-native popup remains in the app shell.
- No obvious leftover navigation or language from the source project.
- Preferably the episode title/code is visible in the canvas shell.

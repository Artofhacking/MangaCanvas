---
name: ui-layout-stability
description: Record and reuse UI optimization cases for layout shift, scrollbar jitter, dropdown or popover side effects, portal overlay collisions, and panel overlap regressions. Use this skill whenever the user says a dropdown, select, tooltip, drawer, modal, or floating layer is "影响布局", "挤右边", "抖动", "错位", "遮挡", "闪一下", or causes nearby UI to move unexpectedly.
---

# UI Layout Stability

Use this skill to fix interaction bugs where opening one UI element changes nearby layout unexpectedly, then capture the root cause and the chosen fix as a reusable case.

## What this skill covers

- Dropdown, select, popover, tooltip, menu, modal, drawer, sheet, and portal-related layout regressions
- Scrollbar compensation issues that cause width changes or right-edge jitter
- Floating layers that participate in layout when they should not
- Overlay/panel combinations that visually collide or steal space from each other
- "Looks small but feels awful" UI issues where the main bug is instability rather than missing functionality

## Workflow

### 1. Reproduce and localize

- Find the exact component that opens the unstable layer.
- Find the container whose width, scroll state, or position changes when the layer opens.
- Check both the trigger component and the shared wrapper used underneath it, such as `Select`, `DropdownMenu`, `Popover`, `Sheet`, `Dialog`, or custom `fixed/absolute` panels.
- Determine where scrolling actually lives:
  - `body/html`
  - an internal `overflow-y-auto` workspace/content pane
  - a drawer or modal-local scroll region
- If the page has a fixed sidebar or fixed top header, inspect those shells too. Many "viewport changed" bugs are really shell-width bugs, not dialog-content bugs.

### 2. Classify the failure mode

Use the smallest accurate label:

- `scroll-lock jitter`: opening the layer changes body or container scrollbar behavior
- `shell compensation mismatch`: the overlay changes scrollbar compensation, and fixed headers or workspace shells do not consume the same gap
- `in-flow overlay`: expanded content still participates in layout and pushes siblings
- `portal collision`: floating content renders in the wrong stacking or positioning context
- `panel overlap`: a newly opened panel competes with an existing drawer/sidebar/tool rail
- `measurement mismatch`: width or position is computed from a stale trigger/container size
- `nested scroll shells`: `body` and an internal workspace/content pane both scroll, often followed by horizontal overflow when `100vw`/`w-screen` ignores scrollbar width

### 3. Prefer project-native fixes

Apply the least disruptive fix that matches the cause:

- If `Select` or another primitive introduces scroll locking or scrollbar compensation, prefer the project's non-modal dropdown/menu pattern when selection behavior does not require the heavier primitive.
- If the app uses an internal scroll shell instead of page scrolling, do not assume fixing `body` is enough. Check whether the shell, fixed header, or fixed rail needs to consume the same scrollbar-compensation variable.
- If a workspace page shows two vertical scrollbars, decide which layer should own scrolling and lock the other one. In this project, shared workspace pages should usually let the inner `main` pane scroll while `body` is locked for that layout.
- If a layout with reserved scrollbar space also uses `100vw` or Tailwind `w-screen`, suspect horizontal overflow immediately. Prefer `w-full` inside app shells unless the viewport width itself is explicitly required.
- When using Radix dialog/sheet primitives, remember that scroll lock may expose `--removed-body-scroll-bar-size`. Reuse that value in project shells before inventing custom JS measurement logic.
- If content is incorrectly affecting layout, move it to `absolute`/`fixed` positioning or a portal.
- If two floating surfaces conflict, make their open states mutually exclusive unless parallel display is clearly intended.
- Preserve the project's existing design language. Change interaction mechanics first; avoid "fixing" by introducing off-brand styles.
- Reuse existing wrappers from the codebase before inventing a new abstraction.

### 4. Choose the fix scope deliberately

- Fix the shared primitive when the bug follows one component everywhere.
- Fix the workspace shell when the bug only appears in layouts with internal scrolling, fixed headers, or sidebars.
- Fix the business component only when the instability is truly local.
- Prefer one shared layout class over repeating page-specific width hacks.

### 5. Verify the fix

Always check:

- The right edge no longer shifts when opening/closing the layer
- Scrollbars do not appear/disappear unexpectedly
- Fixed headers, fixed sidebars, and content panes stay visually aligned
- Keyboard and pointer selection still work
- The active state remains visually clear
- The fix does not introduce a second overlapping panel problem

## Case recording

When a case reveals a reusable pattern, add it to `references/cases.md` with:

- Symptom
- Root cause
- Fix
- Why that fix fit this project
- File references for the implementation

Add new cases instead of rewriting older ones, unless the older case became incorrect.

## Current references

- Reusable cases: [references/cases.md](references/cases.md)

Read the case reference when the issue looks similar to a prior fix. If the current issue differs, still follow the workflow above and append the new case afterward.

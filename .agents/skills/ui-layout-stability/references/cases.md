# UI Layout Stability Cases

## Case 001: ObjectCreator model dropdown shifts the right edge

### Symptom

In the object creation drawer, opening the "选择模型" dropdown made the right side feel unstable. The nearby edge and scrollbar behavior visibly changed when the list opened.

### Root cause

The page used the shared `Select` primitive for model picking inside a custom fixed drawer with an internal scroll container. Opening the select introduced scroll-lock or scrollbar-compensation behavior that changed perceived width and caused right-edge jitter.

### Fix

Replace the model picker in `src/pages/project/ObjectCreator.tsx` from `Select` to the project's `DropdownMenu` pattern. Keep the same visual styling and selected-state feedback, but avoid the heavier interaction primitive that was affecting layout stability.

### Why this fix fit the project

- The interaction only needed simple single-choice selection.
- The project already had a native `DropdownMenu` wrapper configured with `modal={false}` semantics.
- The visual design could be preserved without keeping the problematic primitive.

### Implementation reference

- `src/pages/project/ObjectCreator.tsx`

## How to add future cases

For each new case, append another numbered section using the same structure:

- `Case 00X: <short title>`
- `Symptom`
- `Root cause`
- `Fix`
- `Why this fix fit the project`
- `Implementation reference`

## Case 002: Profile identity submenu feels misplaced on hover

### Symptom

In the project header profile menu, hovering "切换身份" opened a second floating panel that felt visually detached from the main menu. The submenu direction and hover behavior made the interaction look offset and unstable.

### Root cause

The menu used a nested `DropdownMenuSub` for a very small two-option identity switch. That added another positioned floating layer where the interaction did not need one, creating a portal-style alignment mismatch instead of a clear in-panel choice list.

### Fix

Keep the nested submenu in `src/components/layout/ProjectHeader.tsx`, but tune the submenu trigger and panel positioning. Add a small `sideOffset` and `alignOffset` to `DropdownMenuSubContent`, and use the project's regular hover surface styles for `DropdownMenuSubTrigger` so the submenu feels attached instead of overlapping awkwardly.

### Why this fix fit the project

- The product still wanted a true hover submenu for identity switching.
- The issue was visual attachment and hover feel, not the existence of the submenu itself.
- Adjusting the submenu's spacing and styling fixed the interaction without changing the menu architecture.

### Implementation reference

- `src/components/layout/ProjectHeader.tsx`

## Case 003: Project workspace dialogs squeeze the viewport horizontally

### Symptom

In the project workspace, opening confirmation dialogs or creator drawers made the right edge jump. The page looked like it was being squeezed horizontally when the overlay appeared.

### Root cause

The workspace uses a fixed-height shell with an inner `overflow-y-auto` content pane, while shared `Dialog` and `Sheet` primitives still lock body scroll. That body-level scroll lock introduced scrollbar compensation on `body`, even though the visible scrolling happened inside the workspace container.

### Fix

Add a global override in `src/index.css` for `body[data-scroll-locked]` so body keeps `overflow-y: scroll` and does not add right-margin compensation. This preserves the existing modal behavior without letting the viewport width change.

### Why this fix fit the project

- The unstable edge came from shared primitive behavior, not one specific page component.
- The application shell already uses internal scroll containers, so body scrollbar compensation was unnecessary.
- A global guard fixes dialogs and drawers consistently without rewriting every overlay.

### Implementation reference

- `src/index.css`
- `src/pages/project/index.tsx`
- `src/components/feedback/FeedbackProvider.tsx`

## Case 004: Workspace fixed headers jump when dialogs open

### Symptom

In workspace pages with a fixed top header and internal scroll container, opening a dialog kept the overlay visible but made the right edge and header width jump. The content area felt like the viewport briefly widened.

### Root cause

Radix dialog scroll lock still exposes `--removed-body-scroll-bar-size`, and fixed workspace shells sized directly from the viewport did not consume that gap. As a result, the shell and fixed header reflowed when the scrollbar compensation changed.

### Fix

Add shared `workspace-shell` and `workspace-fixed-header` classes in `src/index.css`. Apply the scrollbar compensation variable to the shell padding and fixed header right inset so workspace pages keep the same visual width while dialogs and sheets are open.

### Why this fix fit the project

- The issue affected multiple workspace pages, not one dialog implementation.
- The product layout consistently uses a 16rem sidebar plus fixed top headers.
- Reusing the scroll-lock variable keeps the current modal system intact and avoids page-specific hacks.

### Implementation reference

- `src/index.css`
- `src/components/layout/WorkspaceLayout.tsx`
- `src/components/layout/WorkspaceHeader.tsx`
- `src/components/layout/ProjectHeader.tsx`
- `src/pages/project/index.tsx`
- `src/pages/ProjectsList.tsx`

## Case 005: Profile hover menu intermittently fails to open

### Symptom

In the top-right profile area, moving the cursor over the personal-center trigger would sometimes fail to keep the dropdown open. The issue was more obvious when the cursor moved quickly from the trigger toward the menu surface or the nested identity switcher.

### Root cause

The shared hover menu rendered its content through a portal with a `sideOffset`, which created a small physical hover gap between the trigger and the menu. At the same time, the close timer was short, so the menu could close before the pointer reached the floating content. The nested identity panel also had an under-sized invisible bridge that did not fully cover its offset gap.

### Fix

Update `src/components/ui/hover-menu.tsx` to use a shared hover-open controller with reliable timer cleanup, a slightly longer close delay, `modal={false}`, and `sideOffset={0}` for the simple profile menu. In `src/components/layout/UserProfileMenu.tsx`, add delayed close handling for the identity panel and widen the invisible hover bridge so the pointer can cross into the submenu without dropping the open state.

### Why this fix fit the project

- The instability came from the shared hover interaction mechanics, not the menu visuals.
- The project already uses hover-driven profile affordances, so improving tolerance preserved the intended interaction.
- Fixing the shared primitive plus the local submenu bridge solved both the main menu and the nested panel without redesigning the component.

### Implementation reference

- `src/components/ui/hover-menu.tsx`
- `src/components/layout/UserProfileMenu.tsx`

## Case 006: Workspace dashboard shows nested scrollbars and horizontal overflow

### Symptom

On workspace-style pages such as the dashboard, the viewport showed two vertical scrollbars at once. The inner content pane could scroll, while the browser viewport also kept its own scrollbar. The extra scrollbar width then helped trigger horizontal overflow on the page.

### Root cause

The shared workspace shell used an internal `overflow-y-auto` content area, but `body` still forced a page-level scrollbar globally. At the same time, the shell used `w-screen`, which can exceed the usable viewport width when scrollbar space is reserved. That combination created a double-scroll setup and a subtle horizontal spill.

### Fix

Update `src/components/layout/WorkspaceLayout.tsx` so workspace pages lock body scrolling while mounted, switch the shell from `w-screen` to `w-full`, and force the inner `main` area to own scrolling with `overflow-x-hidden overflow-y-auto`. In `src/index.css`, add a `workspace-body-lock` body class and keep workspace shells constrained to the available width.

### Why this fix fit the project

- The dashboard already uses a shared workspace shell, so the fix belongs in the shared layout rather than one page.
- The product clearly intends a single scroll container inside the app shell.
- Removing `w-screen` avoids scrollbar-width math issues without changing the visual design.

### Implementation reference

- `src/components/layout/WorkspaceLayout.tsx`
- `src/index.css`

## Case 007: Generate settings stay out of the prompt-box flow

### Symptom

Asset generate editors used to put ratio and quantity pills inside the prompt chrome. Expanding that into a full Lib-style settings panel (quality, clarity, ratios, quantity) would push the prompt footer and nearby drawer chrome if the panel stayed in-flow.

### Root cause

An in-flow settings panel participates in the prompt box height. Combined with creator drawers that already own their own scroll container, growing the chrome would reflow the form and the task panel split.

### Fix

Keep a one-line summary capsule in the prompt footer and open the settings as a `DropdownMenu` (`modal={false}`, portaled, `side="top"`). Tile clicks use regular buttons with `onPointerDown` preventDefault so choosing 画质 / 比例 does not dismiss the menu or lock body scroll.

### Why that fix fit this project

- The project already prefers `DropdownMenu` over heavier `Select` / `Dialog` primitives inside drawers (see Case 001).
- The prompt area should stay compact after PR #26 densified ratio/qty into the chrome.
- Portaling the panel avoids competing with the creator sheet’s internal scroll.

### Implementation reference

- `src/components/forms/GenerateSettingsPopover.tsx`
- `src/components/forms/ImageGenerationForm.tsx`

## Case 008: Canvas generate-bar prompt overlay drifts after long Chinese text

### Symptom

On a canvas 画面节点, pasting a long Chinese prompt into `MentionPromptInput` made the visible glyphs and the textarea caret diverge. Lines wrapped at different points, and mention chips looked offset or double-printed.

### Root cause

The field is a transparent textarea under a highlight overlay. Mention tokens used `px-0.5 font-semibold`, which changed measured wrap width versus the plain textarea text. The overlay DIV also inherited canvas `.cn-keep` (`word-break: keep-all` + `line-break: strict`) while the textarea used native wrapping, and `overflow-hidden` vs `overflow-y-auto` plus `scrollbar-gutter` reserved different content widths.

### Fix

Share one field metric class for overlay and textarea (same font, weight, letter-spacing, padding, line-height, white-space, word-break, overflow-wrap, line-break, scrollbar gutter). Reset inherited `cn-keep` wrap. Paint mentions with background/color only (`box-decoration-break: clone`, no horizontal padding or bold). Keep auto-grow + `syncOverlayScroll` from PR #32, but give the overlay the same `overflow-y-auto` model with an invisible scrollbar so widths stay aligned.

### Why this fix fit the project

- The generate bar already used the overlay highlighter; the bug was measurement mismatch, not the mention UX.
- Canvas pages rely on `.cn-keep` for chrome labels, so the prompt field has to opt out locally rather than changing the shell.
- Layout-neutral mention paint keeps `@n` chips readable without shifting CJK wrap.

### Implementation reference

- `src/features/infinite-canvas/components/MentionPromptInput.tsx`
- `src/features/infinite-canvas/utils/mentionPromptLayout.ts`
- `src/features/infinite-canvas/utils/mentionPromptLayout.test.ts`

## Case 009: Generate dock width jumps when option labels change

### Symptom

On a canvas 画面节点 or 视频节点, the prompt dock under the card (reference strip, prompt, and the 角色库 / model / ratio / quality / count / credits / send row) changed width when the user picked another model, ratio, quality, or count. The panel recentered because its width was part of the dock position.

### Root cause

`NodeDockOverlay` sized the generate bar with `width: max-content`. The select triggers were hug-content pills, so a longer model name, ratio (`1:1` vs `21:9`), quality, count, resolution, or duration changed the toolbar's intrinsic width and the outer frame followed. `min-width` on the bar was only an initial estimate and was not applied while `fitContent` was set.

### Fix

Lock the generate dock to a reserved width (`BAR_WIDTH`) and give each trigger a fixed pill width with a truncated label. Credits use a reserved tabular slot, and the send button stays in a non-shrinking trailing group. Image and video share the same bar, so both stay stable when optional controls appear or disappear.

### Why this fix fit the project

- The dock is already a single Lib-style one-line pill row; the bug was the frame hugging those labels.
- A reserved width matches the existing `barWidth` positioning model instead of introducing a new measurement pass.
- Dropdowns stay on the portaled `DropdownMenu`, so opening a menu still does not participate in layout.

### Implementation reference

- `src/features/infinite-canvas/components/NodeGenerateBar.tsx`
- `src/features/infinite-canvas/components/NodeDockOverlay.tsx`

## Case 010: Asset dialogs shift the workspace when scroll lock starts

### Symptom

On 物品管理, and the same workspace shell elsewhere, opening a dialog (上传物品, asset detail, or any other Radix dialog) nudged the tabs, asset grid, and top-right profile slightly sideways. Closing the dialog moved them back.

### Root cause

`scroll-lock jitter` plus `shell compensation mismatch`. Shared `Dialog` / `Sheet` mount Radix `RemoveScroll` (`react-remove-scroll-bar`), which injects an unlayered `body[data-scroll-locked]` rule: `overflow: hidden` and `margin-right` equal to the scrollbar width (6px with the custom scrollbar), and sets `--removed-body-scroll-bar-size`. `html` already uses `scrollbar-gutter: stable`, so that margin is a second reservation. The older `@layer base` override could not beat the injected `!important` margin, and the shell/header also consumed the scrollbar variable. Opening a dialog therefore narrowed the asset grid against the fixed header.

### Fix

Keep scroll locking. Outside `@layer`, `html body[data-scroll-locked]` forces `overflow: hidden`, clears the compensation margin/padding, and sets `--removed-body-scroll-bar-size: 0px !important`. The stable scrollbar gutter keeps the viewport width, so the workspace shell and fixed header no longer pick up a second inset.

Case 011 superseded the gutter-only part of this fix. On overlay scrollbars the gutter does not hold after the viewport bar is removed, so clearing the compensation drops the right margin. The current rule still clears the extra margin, and keeps the root scrollbar instead of relying on the gutter.

### Why this fix fit the project

- Every modal on asset pages goes through the shared Radix dialog primitive, not a page-local overlay.
- The workspace shell and fixed header already share one compensation variable, so correcting that variable fixes 物品管理 and the other workspace pages together.
- Body scroll lock stays in place; only the extra horizontal inset is removed.

### Implementation reference

- `src/index.css`
- `src/components/ui/dialog.tsx`
- `src/components/layout/ProjectHeader.tsx`
- `src/pages/project/index.tsx`

## Case 011: Asset detail dialogs drop the right margin when the scrollbar hides

### Symptom

On 场景管理, and the same project shell for 角色管理 / 物品管理, opening an asset detail dialog removed the gap between the top bar (avatar, credits) / the toolbar (批量删除) and the viewport's right edge. The vertical scrollbar visible while the dialog was closed disappeared, and the page flashed wider. Closing the dialog put the margin back.

### Root cause

`scroll-lock jitter` after Case 010. `::-webkit-scrollbar { width: 6px }` forces a classic scrollbar that consumes layout space, including on macOS where scrollbars are otherwise overlays. `html { scrollbar-gutter: stable }` keeps that space when `overflow` becomes `hidden` on classic-scrollbar platforms, but on overlay-scrollbar platforms the gutter does not hold once the viewport bar is removed. Case 010 zeroed react-remove-scroll's `margin-right` and `--removed-body-scroll-bar-size`, so nothing put the 6px back. Restoring that margin unconditionally shifts classic-scrollbar browsers the other way, because their gutter already held.

### Fix

Move the permanent viewport scrollbar to `html { overflow-y: scroll }`. While `body[data-scroll-locked]` is set, pin the body (`position: fixed`, width 100%, library margin cleared) so the document cannot scroll and the root scrollbar never leaves. `html:has(body.workspace-body-lock)` still hides that root bar on shells whose `main` already scrolls. `installScrollLockAnchor` records the scroll offset in `--scroll-lock-top` so a scrolled page does not jump to the top.

### Why this fix fit the project

- Every modal goes through Radix Dialog/Sheet, which sets `data-scroll-locked` on `body`.
- Asset pages share one workspace shell and fixed header; keeping the root bar stable fixes the header, tabs, and card grid together.
- Workspace layouts that already locked body scrolling stay single-scrollbar.
- The dialog tree, copy, and dismissal behavior stay on the shared primitive.

### Implementation reference

- `src/index.css`
- `src/lib/scrollLockAnchor.ts`
- `src/main.tsx`

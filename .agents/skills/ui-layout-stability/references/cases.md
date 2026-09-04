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

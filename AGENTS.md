# RNAmeta Windows Development Rules

## Scope
- All changes must stay inside `D:\OBS录像\桌面\RNAmeta_Tauri_windows`.
- Do not write code back to old reference projects.

## File Size Limits
- Source files such as `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.R`, `.cjs`, `.mjs`, and other hand-written code files must stay at or below `400` lines.
- CSS files must stay at or below `500` lines.

## Splitting Rule
- If a file grows past the limit, split it before adding more feature logic.
- Prefer feature-local extraction over dumping helpers into unrelated shared files.
- Split by responsibility, for example:
  - components
  - hooks
  - helpers
  - runtime adapters
  - constants
  - config

## Practical Guidance
- Keep module entry files focused on composition, state wiring, and page layout.
- Move export dialogs, summary cards, chart helpers, and request/runtime helpers into nearby module files when they start to dominate a page module.
- Avoid creating new god files while reducing old ones.
- If a generated file exceeds the limit, leave it alone unless we are explicitly editing that generated output.

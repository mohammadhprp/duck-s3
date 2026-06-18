# AGENTS.md

## Project conventions

- Use pnpm for JavaScript package management and scripts (`pnpm install`, `pnpm <script>`).
- Keep the desktop shell on Tauri v2 with React, TypeScript, and Vite.
- Prefer the `@/` alias for imports from `src`.
- Put reusable UI primitives in `src/components/ui` and feature-specific code in `src/features/<feature>`.
- Keep S3 integration code under `src/services/s3` until a feature needs a narrower boundary.
- Use Tailwind utility classes and shadcn/ui-style CSS variables for styling.
- Run `pnpm check` before committing when dependencies are available.

## Pull requests

- Summarize user-visible UI changes and project setup changes.
- Note any checks that could not run because of environment or dependency installation limits.

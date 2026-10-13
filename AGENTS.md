# AGENTS.md

Guía para agentes y personas que trabajan en `pqrs-web`.

- Interfaz en español; identificadores, commits y PR en inglés.
- Gestor de paquetes: pnpm (versión en `packageManager`). Node en `.nvmrc`.
- Antes de un PR: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:api`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

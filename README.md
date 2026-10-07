# Jason-OS

A modular, privacy-first "psychological operating system" in TypeScript — a research-grade architecture exploring psychological safety, emotional telemetry, and privacy-preserving computation. The user is treated as a psychological system whose boundaries and emotional states the software must respect, not as a data source to be extracted.

## Features

- **Four-tier privacy model** (`PUBLIC` → `SOFT` → `SHADOW` → `GHOST`) as a first-class architectural primitive: each tier pins persistence, encryption depth (AES-256-GCM), and ephemerality guarantees, from standard storage (PUBLIC) through plausibly deniable encrypted vaults (SHADOW) to memory-only burner sessions (GHOST).
- **~40 packages** organized in four layers: emotional (emotional-telemetry, calm-switch, drift-cell, soft-anchor, echo-silence, pulse-check-os, undercurrent), identity (identity-manager, shadow-atlas, ghost-span, shadow-persona), productivity (quiet-span, quiet-quorum, soft-barrier, soft-lockstep, ghost-rhythm, silent-ops), and privacy (privacy-kernel, encrypted-vaults, shadow-logs, shadow-mode, ghost-workspace, underveil, stealth-ledger-pro).
- **Core infrastructure**: event bus, module registry/loader, session manager, sync engine, and storage adapters (localStorage / IndexedDB / memory).
- `demo.html`, `emotion-demo.html`, and `ultimate-demo.html` at the repo root for browser-based demos.
- MIT licensed; Vitest test suite; turbo/pnpm workspace layout.

## Tech stack

TypeScript 5.3+, Node.js, Vitest, Turbo, pnpm workspaces. Per the root `package.json` (v0.6.0): `tsc -b` build, `vitest run` tests, eslint + prettier.

## Getting started

From `package.json` (an `INSTALL.md` with more detail exists at the repo root):

- `pnpm install` — install workspace dependencies
- `pnpm build` — `tsc -b` across packages
- `pnpm test` — run the Vitest suite
- `pnpm typecheck` — `tsc -b --noEmit`

## Project structure

```
.
├── packages/            # ~40 modules (emotional / identity / productivity / privacy layers)
├── demo.html, emotion-demo.html, ultimate-demo.html   # browser demos
├── ARCHITECTURE.md      # architecture docs
├── INSTALL.md           # install instructions
├── turbo.json, pnpm-workspace.yaml
└── vitest.config.js
```

## Status

**Active research project.** The repo ships an extensive README with an architecture diagram and a privacy-tier table; the README here is a condensed version. A YouTube Short is linked at the top of the original README.

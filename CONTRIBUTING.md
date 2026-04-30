# Contributing

Thanks for helping improve SDM ClickHouse. The best contributions are focused, reproducible, and easy for another maintainer to validate.

## Local setup

1. Install prerequisites: Node.js 20+, pnpm 10+, Rust toolchain, and the platform build tooling required by Tauri.
2. Install dependencies: `pnpm install`.
3. Run desktop app: `pnpm tauri dev`.

Use `pnpm dev` only for browser-only UI layout work. End-to-end behavior depends on the Tauri runtime.

## Required checks

Run before opening a PR:

```powershell
pnpm validate
```

If you are iterating on a narrow change, these focused checks are useful:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

Run Playwright tests for behavior that touches app startup, connection dialogs, query interactions, or recovery flows:

```powershell
pnpm test:e2e
```

## Issues

- Use the bug template for reproducible problems.
- Include app version, OS, ClickHouse version when known, and screenshots or logs when they help.
- Use the feature template for product ideas and describe the workflow problem first.
- Do not report security vulnerabilities in public issues. Follow [SECURITY.md](./SECURITY.md).

## PR title convention

Use Conventional Commit style:

- `feat(scope): add query cancellation UX`
- `fix(tauri): handle updater config parsing`
- `docs(readme): update release section`

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.

## Commit and PR quality

- Keep PRs focused and reviewable.
- Include screenshots for UI changes.
- Link issues using `Closes #123` where appropriate.
- Update README, docs, or command references when behavior changes.
- Avoid mixing formatting-only churn with feature or bug-fix changes.

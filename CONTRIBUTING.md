# Contributing

## Local setup

1. Install prerequisites: Node.js 22+, pnpm, Rust toolchain.
2. Install dependencies: `pnpm install`.
3. Run desktop app: `pnpm tauri dev`.

## Required checks

Run before opening a PR:

1. `pnpm typecheck`
2. `pnpm knip`
3. `pnpm build`
4. `cargo check --manifest-path src-tauri/Cargo.toml`

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

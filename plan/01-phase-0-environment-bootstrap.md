# Phase 0 - Environment + Bootstrap

## Objective

Prepare local machine and repository for Tauri development, including automatic Rust setup, validation, and initial app scaffolding with shadcn/ui.

## Tasks

1. Install Rust toolchain automatically.
2. Validate Rust/Cargo/rustup availability and versions.
3. Scaffold Tauri + React + TypeScript project in current repo.
4. Install and initialize shadcn/ui in the React app.
5. Run full validation checks for dev startup and build path.

## Automated Setup Steps (Windows)

1. Install Rust:

```powershell
winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements
```

2. Refresh shell path and set stable toolchain:

```powershell
$env:Path += ";$env:USERPROFILE\.cargo\bin"
rustup default stable
```

3. Validate tools:

```powershell
rustup --version
rustc --version
cargo --version
```

## Project Bootstrap Steps

1. Create Tauri app (React + TS + pnpm, non-interactive where possible).
2. Install frontend deps and Tauri CLI/api deps.
3. Install Tailwind CSS and configure Vite aliases.
4. Initialize shadcn/ui and add base components:
   - button
   - input
   - dialog
   - tabs
   - table
   - textarea
   - dropdown-menu
5. Create starter layout shell:
   - left connection/schema panel
   - top query tabs bar
   - main editor/results split

## Validation Checklist

1. `pnpm tauri info` shows Rust toolchain and prerequisites.
2. `pnpm build` passes.
3. `pnpm tauri build --debug` passes.
4. shadcn components render in app shell.
5. No secret values are hardcoded in source.

## Status

- Rust installed and validated.
- Tauri app scaffolded.
- shadcn/ui initialized and base components added.
- Build and Tauri debug bundle succeeded.

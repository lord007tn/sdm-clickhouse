import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const home = process.env.USERPROFILE || process.env.HOME || "";
const cargoName = process.platform === "win32" ? "cargo.exe" : "cargo";

const candidates = [
  "cargo",
  home ? path.join(home, ".cargo", "bin", cargoName) : null,
].filter(Boolean);

for (const candidate of candidates) {
  const result = spawnSync(candidate, ["check", "--manifest-path", "src-tauri/Cargo.toml"], {
    stdio: "inherit",
  });

  if (!result.error && result.status === 0) {
    process.exit(0);
  }
}

console.error("Unable to run cargo check. Ensure Rust is installed and cargo is available.");
process.exit(1);

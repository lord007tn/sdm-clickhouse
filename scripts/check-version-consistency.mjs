import fs from "node:fs";
import path from "node:path";

function readJson(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function readCargoPackageVersion(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  const content = fs.readFileSync(fullPath, "utf8");
  const packageSection = content.match(/\[package\][\s\S]*?(\n\[[^\]]+\]|$)/);
  if (!packageSection) {
    throw new Error("Could not find [package] section in Cargo.toml");
  }
  const versionMatch = packageSection[0].match(/^version\s*=\s*"([^"]+)"\s*$/m);
  if (!versionMatch) {
    throw new Error("Could not find package version in Cargo.toml");
  }
  return versionMatch[1];
}

function fail(message) {
  console.error(`Version consistency check failed: ${message}`);
  process.exit(1);
}

const packageJsonVersion = readJson("package.json").version;
const tauriConfigVersion = readJson("src-tauri/tauri.conf.json").version;
const cargoVersion = readCargoPackageVersion("src-tauri/Cargo.toml");

const uniqueVersions = new Set([
  packageJsonVersion,
  tauriConfigVersion,
  cargoVersion,
]);

if (uniqueVersions.size !== 1) {
  fail(
    `manifest versions differ (package.json=${packageJsonVersion}, tauri.conf.json=${tauriConfigVersion}, Cargo.toml=${cargoVersion})`,
  );
}

const rawTag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "";
const normalizedTag = rawTag.trim();
if (normalizedTag) {
  const expectedTag = `v${packageJsonVersion}`;
  if (normalizedTag !== expectedTag) {
    fail(`tag ${normalizedTag} does not match manifest version ${expectedTag}`);
  }
}

console.log(`Version consistency check passed: ${packageJsonVersion}`);

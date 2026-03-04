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

function readCargoLockPackageVersion(relativePath, packageName) {
  const content = readText(relativePath);
  const packagePattern = new RegExp(
    `\\[\\[package\\]\\][\\s\\S]*?name\\s*=\\s*"${packageName}"\\s*[\\r\\n]+version\\s*=\\s*"([^"]+)"`,
    "m",
  );
  const match = content.match(packagePattern);
  if (!match) {
    throw new Error(
      `Could not find package '${packageName}' version in Cargo.lock`,
    );
  }
  return match[1];
}

function readText(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf8");
}

function fail(message) {
  console.error(`Version consistency check failed: ${message}`);
  process.exit(1);
}

const packageJsonVersion = readJson("package.json").version;
const tauriConfigVersion = readJson("src-tauri/tauri.conf.json").version;
const cargoVersion = readCargoPackageVersion("src-tauri/Cargo.toml");
const cargoLockVersion = readCargoLockPackageVersion(
  "src-tauri/Cargo.lock",
  "tauri-app",
);

const uniqueVersions = new Set([
  packageJsonVersion,
  tauriConfigVersion,
  cargoVersion,
  cargoLockVersion,
]);

if (uniqueVersions.size !== 1) {
  fail(
    `manifest versions differ (package.json=${packageJsonVersion}, tauri.conf.json=${tauriConfigVersion}, Cargo.toml=${cargoVersion}, Cargo.lock=${cargoLockVersion})`,
  );
}

const appTsx = readText("src/App.tsx");
const hardcodedFrontendVersionMatch = appTsx.match(
  /\bconst\s+APP_VERSION\s*=\s*"([^"]+)"/,
);
if (hardcodedFrontendVersionMatch) {
  fail(
    `frontend APP_VERSION is hardcoded (${hardcodedFrontendVersionMatch[1]}). Use __APP_VERSION__ to keep release versions aligned.`,
  );
}

const cliRef = (process.argv[2] ?? "").trim();
const envRefName = (process.env.GITHUB_REF_NAME ?? "").trim();
const envRefType = (process.env.GITHUB_REF_TYPE ?? "").trim().toLowerCase();

const normalizedTag = cliRef || (envRefType === "tag" ? envRefName : "");
if (normalizedTag) {
  if (!normalizedTag.startsWith("v")) {
    fail(`tag ${normalizedTag} must start with 'v'`);
  }
  const expectedTag = `v${packageJsonVersion}`;
  if (normalizedTag !== expectedTag) {
    fail(`tag ${normalizedTag} does not match manifest version ${expectedTag}`);
  }
}

console.log(`Version consistency check passed: ${packageJsonVersion}`);

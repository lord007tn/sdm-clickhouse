#!/usr/bin/env bash
set -euo pipefail

REPO="${SIMPLE_SDM_REPO:-lord007tn/simple-sdm}"
VERSION="${SIMPLE_SDM_VERSION:-latest}"
CHECK_ONLY=0
GITHUB_TOKEN_VALUE="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

usage() {
  cat <<'USAGE'
Simple SDM installer

Usage:
  install.sh [--version <version>] [--repo <owner/repo>] [--check]

Environment:
  SIMPLE_SDM_VERSION=<version|latest>
  SIMPLE_SDM_REPO=<owner/repo>
  SIMPLE_SDM_APPIMAGE_DIR=<dir>   # default: ~/.local/bin
  GITHUB_TOKEN / GH_TOKEN          # optional, needed for private repos
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --check)
      CHECK_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for release parsing." >&2
  exit 1
fi

detect_os() {
  case "$(uname -s)" in
    Linux) echo "linux" ;;
    Darwin) echo "macos" ;;
    *) echo "unsupported" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "unknown" ;;
  esac
}

calc_sha256() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
    return
  fi
  echo "No SHA256 tool found (need sha256sum or shasum)." >&2
  exit 1
}

OS_NAME="$(detect_os)"
ARCH_NAME="$(detect_arch)"
if [[ "$OS_NAME" == "unsupported" ]]; then
  echo "Unsupported OS for install.sh. Use install.ps1 on Windows." >&2
  exit 1
fi

if [[ "$VERSION" == "latest" ]]; then
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"
else
  TAG="$VERSION"
  [[ "$TAG" == v* ]] || TAG="v$TAG"
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/tags/${TAG}"
fi

API_HEADERS=(-H 'Accept: application/vnd.github+json')
if [[ -n "$GITHUB_TOKEN_VALUE" ]]; then
  API_HEADERS+=(-H "Authorization: Bearer ${GITHUB_TOKEN_VALUE}")
fi

echo "Resolving release metadata from ${RELEASE_URL}"
RELEASE_JSON="$(curl -fsSL "${API_HEADERS[@]}" "$RELEASE_URL")"

SELECTION="$(printf '%s' "$RELEASE_JSON" | python3 - "$OS_NAME" "$ARCH_NAME" <<'PY'
import json
import sys

os_name = sys.argv[1]
arch = sys.argv[2]
release = json.load(sys.stdin)
assets = release.get("assets") or []
tag = (release.get("tag_name") or "").lstrip("v")

def pick_asset():
    names = [(a, (a.get("name") or "").lower()) for a in assets]
    def find(pred):
        for asset, lower in names:
            if pred(lower):
                return asset
        return None

    if os_name == "linux":
        if arch == "arm64":
            return (
                find(lambda n: n.endswith("_arm64.deb"))
                or find(lambda n: n.endswith("_aarch64.deb"))
                or find(lambda n: n.endswith(".appimage") and "aarch64" in n)
            )
        return (
            find(lambda n: n.endswith("_amd64.deb"))
            or find(lambda n: n.endswith("_x64.deb"))
            or find(lambda n: n.endswith(".appimage") and "amd64" in n)
            or find(lambda n: n.endswith(".appimage"))
        )

    if os_name == "macos":
        if arch == "arm64":
            return find(lambda n: n.endswith("_aarch64.dmg"))
        return (
            find(lambda n: n.endswith("_x64.dmg"))
            or find(lambda n: n.endswith("_amd64.dmg"))
            or find(lambda n: n.endswith(".dmg"))
        )

    return None

asset = pick_asset()
if not asset:
    print("ERROR:No compatible asset found", end="")
    sys.exit(2)

digest = (asset.get("digest") or "").lower().strip()
if not digest.startswith("sha256:"):
    print("ERROR:Missing SHA256 digest in release metadata", end="")
    sys.exit(3)

sha256 = digest.split(":", 1)[1]
print(f"{tag}|{asset.get('name','')}|{asset.get('browser_download_url','')}|{sha256}", end="")
PY
)"

if [[ "$SELECTION" == ERROR:* ]]; then
  echo "${SELECTION#ERROR:}" >&2
  exit 1
fi

IFS='|' read -r LATEST_VERSION ASSET_NAME DOWNLOAD_URL EXPECTED_SHA256 <<<"$SELECTION"
if [[ -z "$ASSET_NAME" || -z "$DOWNLOAD_URL" || -z "$EXPECTED_SHA256" ]]; then
  echo "Release selection failed." >&2
  exit 1
fi

echo "Target release: v${LATEST_VERSION}"
echo "Selected asset: ${ASSET_NAME} (${OS_NAME}/${ARCH_NAME})"

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "Check only mode: update available and hash metadata resolved."
  exit 0
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
ASSET_PATH="${TMP_DIR}/${ASSET_NAME}"

echo "Downloading asset..."
curl -fL "${API_HEADERS[@]}" "$DOWNLOAD_URL" -o "$ASSET_PATH"

ACTUAL_SHA256="$(calc_sha256 "$ASSET_PATH")"
if [[ "${ACTUAL_SHA256,,}" != "${EXPECTED_SHA256,,}" ]]; then
  echo "SHA256 mismatch." >&2
  echo "Expected: $EXPECTED_SHA256" >&2
  echo "Actual:   $ACTUAL_SHA256" >&2
  exit 1
fi
echo "SHA256 verified."

install_linux() {
  local file="$1"
  local name_lower
  name_lower="$(echo "$ASSET_NAME" | tr '[:upper:]' '[:lower:]')"

  if [[ "$name_lower" == *.deb ]]; then
    if [[ "$(id -u)" -ne 0 && -n "$(command -v sudo || true)" ]]; then
      sudo dpkg -i "$file"
    else
      dpkg -i "$file"
    fi
    return
  fi

  if [[ "$name_lower" == *.appimage ]]; then
    local install_dir="${SIMPLE_SDM_APPIMAGE_DIR:-$HOME/.local/bin}"
    local target="${install_dir}/simple-sdm.AppImage"
    mkdir -p "$install_dir"
    cp "$file" "$target"
    chmod +x "$target"
    echo "Installed AppImage to ${target}"
    echo "Run it with: ${target}"
    return
  fi

  echo "Unsupported Linux asset: ${ASSET_NAME}" >&2
  exit 1
}

install_macos() {
  local file="$1"
  local mount_dir app_path
  mount_dir="$(hdiutil attach "$file" -nobrowse -quiet | awk '/\/Volumes\// {print $3; exit}')"
  if [[ -z "$mount_dir" ]]; then
    echo "Failed to mount DMG." >&2
    exit 1
  fi
  app_path="$(find "$mount_dir" -maxdepth 1 -name '*.app' -type d | head -n 1)"
  if [[ -z "$app_path" ]]; then
    hdiutil detach "$mount_dir" -quiet || true
    echo "No .app found in DMG." >&2
    exit 1
  fi
  cp -R "$app_path" /Applications/
  hdiutil detach "$mount_dir" -quiet || true
  echo "Installed $(basename "$app_path") into /Applications"
}

case "$OS_NAME" in
  linux) install_linux "$ASSET_PATH" ;;
  macos) install_macos "$ASSET_PATH" ;;
esac

echo "Simple SDM installation complete."

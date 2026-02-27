#!/usr/bin/env bash
set -euo pipefail

REPO="${SDM_CLICKHOUSE_REPO:-lord007tn/sdm-clickhouse}"
VERSION="${SDM_CLICKHOUSE_VERSION:-latest}"
CHECK_ONLY=0
SYSTEM_INSTALL="${SDM_CLICKHOUSE_SYSTEM_INSTALL:-0}"
PORTABLE_MODE="${SDM_CLICKHOUSE_PORTABLE:-0}"
GITHUB_TOKEN_VALUE="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

usage() {
  cat <<'USAGE'
SDM ClickHouse installer

Usage:
  install.sh [--version <version>] [--repo <owner/repo>] [--check] [--system] [--portable]

Environment:
  SDM_CLICKHOUSE_VERSION=<version|latest>
  SDM_CLICKHOUSE_REPO=<owner/repo>
  SDM_CLICKHOUSE_APPIMAGE_DIR=<dir>   # default: ~/.local/bin
  SDM_CLICKHOUSE_SYSTEM_INSTALL=1      # optional, use system-level install paths
  SDM_CLICKHOUSE_PORTABLE=1            # optional, prefer portable assets
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
    --system)
      SYSTEM_INSTALL=1
      shift
      ;;
    --portable)
      PORTABLE_MODE=1
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
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases?per_page=20"
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

SELECTION="$(printf '%s' "$RELEASE_JSON" | python3 - "$OS_NAME" "$ARCH_NAME" "$PORTABLE_MODE" <<'PY'
import json
import sys

os_name = sys.argv[1]
arch = sys.argv[2]
prefer_portable = sys.argv[3] == "1"
data = json.load(sys.stdin)
releases = data if isinstance(data, list) else [data]

def pick_asset(assets):
    names = [(a, (a.get("name") or "").lower()) for a in assets]
    def find(pred):
        for asset, lower in names:
            if pred(lower):
                return asset
        return None

    if os_name == "linux":
        if prefer_portable:
            if arch == "arm64":
                return (
                    find(lambda n: n.endswith(".appimage") and "aarch64" in n)
                    or find(lambda n: n.endswith(".appimage") and "arm64" in n)
                    or find(lambda n: n.endswith(".appimage"))
                )
            return (
                find(lambda n: n.endswith(".appimage") and "amd64" in n)
                or find(lambda n: n.endswith(".appimage") and "x64" in n)
                or find(lambda n: n.endswith(".appimage"))
            )
        if arch == "arm64":
            return (
                find(lambda n: n.endswith(".appimage") and "aarch64" in n)
                or find(lambda n: n.endswith(".appimage"))
                or find(lambda n: n.endswith("_arm64.deb"))
                or find(lambda n: n.endswith("_aarch64.deb"))
            )
        return (
            find(lambda n: n.endswith(".appimage") and "amd64" in n)
            or find(lambda n: n.endswith(".appimage"))
            or find(lambda n: n.endswith("_amd64.deb"))
            or find(lambda n: n.endswith("_x64.deb"))
        )

    if os_name == "macos":
        if prefer_portable:
            if arch == "arm64":
                return (
                    find(lambda n: n.endswith(".app.tar.gz") and ("aarch64" in n or "arm64" in n))
                    or find(lambda n: n.endswith(".app.tar.gz"))
                )
            return (
                find(lambda n: n.endswith(".app.tar.gz") and ("x64" in n or "amd64" in n))
                or find(lambda n: n.endswith(".app.tar.gz"))
            )
        if arch == "arm64":
            return find(lambda n: n.endswith("_aarch64.dmg"))
        return (
            find(lambda n: n.endswith("_x64.dmg"))
            or find(lambda n: n.endswith("_amd64.dmg"))
            or find(lambda n: n.endswith(".dmg"))
        )

    return None

selected_release = None
selected_asset = None
selected_sha256 = None

for release in releases:
    if release.get("draft") or release.get("prerelease"):
        continue
    assets = release.get("assets") or []
    asset = pick_asset(assets)
    if not asset:
        continue
    digest = (asset.get("digest") or "").lower().strip()
    if not digest.startswith("sha256:"):
        continue
    selected_release = release
    selected_asset = asset
    selected_sha256 = digest.split(":", 1)[1]
    break

if not selected_release or not selected_asset or not selected_sha256:
    print("ERROR:No compatible asset found", end="")
    sys.exit(2)

tag = (selected_release.get("tag_name") or "").lstrip("v")
print(
    f"{tag}|{selected_asset.get('name','')}|{selected_asset.get('browser_download_url','')}|{selected_sha256}",
    end="",
)
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
    if [[ "$SYSTEM_INSTALL" != "1" ]]; then
      echo "Refusing system .deb install without --system. Re-run with --system or use AppImage." >&2
      exit 1
    fi
    if [[ "$(id -u)" -ne 0 ]]; then
      if command -v sudo >/dev/null 2>&1; then
        sudo dpkg -i "$file"
      else
        echo "Root permission required for .deb install and sudo is unavailable." >&2
        exit 1
      fi
    else
      dpkg -i "$file"
    fi
    return
  fi

  if [[ "$name_lower" == *.appimage ]]; then
    local install_dir="${SDM_CLICKHOUSE_APPIMAGE_DIR:-$HOME/.local/bin}"
    local target="${install_dir}/sdm-clickhouse.AppImage"
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
  local name_lower app_path
  name_lower="$(echo "$ASSET_NAME" | tr '[:upper:]' '[:lower:]')"

  copy_macos_app() {
    local source_app="$1"
    local app_dest
    if [[ "$SYSTEM_INSTALL" == "1" ]]; then
      app_dest="/Applications"
      if [[ ! -w "$app_dest" ]]; then
        if command -v sudo >/dev/null 2>&1; then
          sudo cp -R "$source_app" "$app_dest/"
        else
          echo "Write permission to /Applications denied and sudo is unavailable." >&2
          return 1
        fi
        echo "Installed $(basename "$source_app") into /Applications"
        return 0
      fi
    else
      app_dest="${HOME}/Applications"
      mkdir -p "$app_dest"
    fi
    cp -R "$source_app" "$app_dest/"
    echo "Installed $(basename "$source_app") into ${app_dest}"
    return 0
  }

  if [[ "$name_lower" == *.app.tar.gz ]]; then
    local extract_dir="${TMP_DIR}/macos-portable-app"
    mkdir -p "$extract_dir"
    tar -xzf "$file" -C "$extract_dir"
    app_path="$(find "$extract_dir" -name '*.app' -type d | head -n 1)"
    if [[ -z "$app_path" ]]; then
      echo "No .app found in portable archive." >&2
      exit 1
    fi
    copy_macos_app "$app_path" || exit 1
    return
  fi

  local mount_dir
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
  if ! copy_macos_app "$app_path"; then
    hdiutil detach "$mount_dir" -quiet || true
    exit 1
  fi
  hdiutil detach "$mount_dir" -quiet || true
}

case "$OS_NAME" in
  linux) install_linux "$ASSET_PATH" ;;
  macos) install_macos "$ASSET_PATH" ;;
esac

echo "SDM ClickHouse installation complete."

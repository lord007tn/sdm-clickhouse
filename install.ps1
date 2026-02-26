param(
  [string]$Version = $(if ($env:SIMPLE_SDM_VERSION) { $env:SIMPLE_SDM_VERSION } else { "latest" }),
  [string]$Repo = $(if ($env:SIMPLE_SDM_REPO) { $env:SIMPLE_SDM_REPO } else { "lord007tn/simple-sdm" }),
  [string]$GitHubToken = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { "" }),
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Get-OsName {
  if ($IsWindows) { return "windows" }
  if ($IsLinux) { return "linux" }
  if ($IsMacOS) { return "macos" }
  return "unknown"
}

function Get-ArchName {
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  if ($arch -eq "x64") { return "x64" }
  if ($arch -eq "arm64") { return "arm64" }
  return "unknown"
}

function Select-Asset {
  param(
    [array]$Assets,
    [string]$OsName,
    [string]$ArchName
  )

  $withLower = $Assets | ForEach-Object {
    [PSCustomObject]@{ Asset = $_; Name = $_.name.ToLowerInvariant() }
  }

  function Find-Asset([scriptblock]$Predicate) {
    $hit = $withLower | Where-Object { & $Predicate $_.Name } | Select-Object -First 1
    if ($null -ne $hit) { return $hit.Asset }
    return $null
  }

  function First-Asset([array]$Candidates) {
    foreach ($candidate in $Candidates) {
      if ($null -ne $candidate) { return $candidate }
    }
    return $null
  }

  if ($OsName -eq "windows") {
    if ($ArchName -eq "arm64") {
      return First-Asset @(
        (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("arm64") }),
        (Find-Asset { param($n) $n.EndsWith(".exe") -and $n.Contains("arm64") })
      )
    }
    return First-Asset @(
      (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("x64") }),
      (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("amd64") }),
      (Find-Asset { param($n) $n.EndsWith("-setup.exe") -and $n.Contains("x64") }),
      (Find-Asset { param($n) $n.EndsWith(".exe") })
    )
  }

  if ($OsName -eq "linux") {
    if ($ArchName -eq "arm64") {
      return First-Asset @(
        (Find-Asset { param($n) $n.EndsWith("_arm64.deb") }),
        (Find-Asset { param($n) $n.EndsWith("_aarch64.deb") }),
        (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("aarch64") })
      )
    }
    return First-Asset @(
      (Find-Asset { param($n) $n.EndsWith("_amd64.deb") }),
      (Find-Asset { param($n) $n.EndsWith("_x64.deb") }),
      (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("amd64") }),
      (Find-Asset { param($n) $n.EndsWith(".appimage") })
    )
  }

  if ($OsName -eq "macos") {
    if ($ArchName -eq "arm64") {
      return Find-Asset { param($n) $n.EndsWith("_aarch64.dmg") }
    }
    return First-Asset @(
      (Find-Asset { param($n) $n.EndsWith("_x64.dmg") }),
      (Find-Asset { param($n) $n.EndsWith("_amd64.dmg") }),
      (Find-Asset { param($n) $n.EndsWith(".dmg") })
    )
  }

  return $null
}

function Assert-Sha256 {
  param(
    [string]$Path,
    [string]$Expected
  )
  $hash = (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  $exp = $Expected.ToLowerInvariant()
  if ($hash -ne $exp) {
    throw "SHA256 mismatch. Expected $exp but got $hash"
  }
}

function Install-Asset {
  param(
    [string]$Path,
    [string]$AssetName,
    [string]$OsName
  )

  $lower = $AssetName.ToLowerInvariant()

  if ($OsName -eq "windows") {
    if ($lower.EndsWith(".msi")) {
      Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$Path`" /passive /norestart" -Wait
      return
    }
    if ($lower.EndsWith(".exe")) {
      Start-Process -FilePath $Path -Wait
      return
    }
    throw "Unsupported Windows asset: $AssetName"
  }

  if ($OsName -eq "linux") {
    if ($lower.EndsWith(".deb")) {
      if (Get-Command sudo -ErrorAction SilentlyContinue) {
        & sudo dpkg -i $Path
      } else {
        & dpkg -i $Path
      }
      return
    }
    if ($lower.EndsWith(".appimage")) {
      $targetDir = if ($env:SIMPLE_SDM_APPIMAGE_DIR) { $env:SIMPLE_SDM_APPIMAGE_DIR } else { Join-Path $HOME ".local/bin" }
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
      $targetPath = Join-Path $targetDir "simple-sdm.AppImage"
      Copy-Item -Force -Path $Path -Destination $targetPath
      & chmod +x $targetPath
      Write-Host "Installed AppImage to $targetPath"
      return
    }
    throw "Unsupported Linux asset: $AssetName"
  }

  if ($OsName -eq "macos") {
    if (-not $lower.EndsWith(".dmg")) {
      throw "Unsupported macOS asset: $AssetName"
    }
    $mountLine = & hdiutil attach $Path -nobrowse -quiet | Select-String "/Volumes/" | Select-Object -First 1
    if ($null -eq $mountLine) {
      throw "Failed to mount DMG."
    }
    $mountPoint = ($mountLine.ToString() -split "\s+")[-1]
    $app = Get-ChildItem -Path $mountPoint -Filter *.app -Directory | Select-Object -First 1
    if ($null -eq $app) {
      & hdiutil detach $mountPoint -quiet | Out-Null
      throw "No .app found in DMG."
    }
    Copy-Item -Recurse -Force -Path $app.FullName -Destination "/Applications/"
    & hdiutil detach $mountPoint -quiet | Out-Null
    return
  }

  throw "Unsupported OS: $OsName"
}

$osName = Get-OsName
$archName = Get-ArchName
if ($osName -eq "unknown") {
  throw "Unsupported operating system."
}

$releaseUrl = if ($Version -eq "latest") {
  "https://api.github.com/repos/$Repo/releases/latest"
} else {
  $tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
  "https://api.github.com/repos/$Repo/releases/tags/$tag"
}

Write-Host "Resolving release metadata from $releaseUrl"
$headers = @{ Accept = "application/vnd.github+json" }
if ($GitHubToken) {
  $headers.Authorization = "Bearer $GitHubToken"
}
$release = Invoke-RestMethod -Uri $releaseUrl -Headers $headers
$asset = Select-Asset -Assets $release.assets -OsName $osName -ArchName $archName
if ($null -eq $asset) {
  throw "No compatible release asset found for $osName/$archName."
}

$digest = [string]$asset.digest
if (-not $digest.StartsWith("sha256:")) {
  throw "Release asset digest is missing SHA256 metadata."
}
$expectedSha256 = $digest.Substring(7)
$latestVersion = ([string]$release.tag_name).TrimStart("v")

Write-Host "Target release: v$latestVersion"
Write-Host "Selected asset: $($asset.name) ($osName/$archName)"

if ($CheckOnly) {
  Write-Host "Check only mode: update metadata resolved."
  exit 0
}

$tmpPath = Join-Path ([System.IO.Path]::GetTempPath()) $asset.name
Write-Host "Downloading asset..."
Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -OutFile $tmpPath

Assert-Sha256 -Path $tmpPath -Expected $expectedSha256
Write-Host "SHA256 verified."

Install-Asset -Path $tmpPath -AssetName $asset.name -OsName $osName

Write-Host "Simple SDM installation complete."

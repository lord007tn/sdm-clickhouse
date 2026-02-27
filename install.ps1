param(
  [string]$Version = $(if ($env:SDM_CLICKHOUSE_VERSION) { $env:SDM_CLICKHOUSE_VERSION } else { "latest" }),
  [string]$Repo = $(if ($env:SDM_CLICKHOUSE_REPO) { $env:SDM_CLICKHOUSE_REPO } else { "lord007tn/sdm-clickhouse" }),
  [string]$GitHubToken = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { "" }),
  [switch]$SystemInstall,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Get-OsName {
  $platform = [System.Runtime.InteropServices.OSPlatform]
  if ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform($platform::Windows)) { return "windows" }
  if ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform($platform::Linux)) { return "linux" }
  if ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform($platform::OSX)) { return "macos" }
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
        (Find-Asset { param($n) $n.EndsWith(".exe") -and $n.Contains("arm64") }),
        (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("arm64") })
      )
    }
    return First-Asset @(
      (Find-Asset { param($n) $n.EndsWith("-setup.exe") -and $n.Contains("x64") }),
      (Find-Asset { param($n) $n.EndsWith(".exe") }),
      (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("x64") }),
      (Find-Asset { param($n) $n.EndsWith(".msi") -and $n.Contains("amd64") }),
      (Find-Asset { param($n) $n.EndsWith(".msi") })
    )
  }

  if ($OsName -eq "linux") {
    if ($ArchName -eq "arm64") {
      return First-Asset @(
        (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("aarch64") }),
        (Find-Asset { param($n) $n.EndsWith(".appimage") }),
        (Find-Asset { param($n) $n.EndsWith("_arm64.deb") }),
        (Find-Asset { param($n) $n.EndsWith("_aarch64.deb") })
      )
    }
    return First-Asset @(
      (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("amd64") }),
      (Find-Asset { param($n) $n.EndsWith(".appimage") }),
      (Find-Asset { param($n) $n.EndsWith("_amd64.deb") }),
      (Find-Asset { param($n) $n.EndsWith("_x64.deb") })
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

function Invoke-GitHubApi {
  param(
    [string]$Url,
    [hashtable]$Headers
  )
  try {
    return Invoke-RestMethod -Uri $Url -Headers $Headers
  } catch {
    $message = $_.Exception.Message
    if ($message -match "404") {
      throw "GitHub API returned 404 for '$Url'. Check repository name/visibility and set GITHUB_TOKEN (or GH_TOKEN) for private repositories."
    }
    throw
  }
}

function Install-Asset {
  param(
    [string]$Path,
    [string]$AssetName,
    [string]$OsName,
    [bool]$SystemInstallMode = $false
  )

  $lower = $AssetName.ToLowerInvariant()

  if ($OsName -eq "windows") {
    if ($lower.EndsWith(".msi")) {
      $args = if ($SystemInstallMode) {
        "/i `"$Path`" /passive /norestart"
      } else {
        "/i `"$Path`" MSIINSTALLPERUSER=1 ALLUSERS=2 /qb /norestart"
      }
      Start-Process -FilePath "msiexec.exe" -ArgumentList $args -Wait
      return
    }
    if ($lower.EndsWith(".exe")) {
      if ($SystemInstallMode) {
        Start-Process -FilePath $Path -Wait
      } else {
        Start-Process -FilePath $Path -ArgumentList "/CURRENTUSER" -Wait
      }
      return
    }
    throw "Unsupported Windows asset: $AssetName"
  }

  if ($OsName -eq "linux") {
    if ($lower.EndsWith(".deb")) {
      if (-not $SystemInstallMode) {
        throw "Refusing .deb install without -SystemInstall. Use AppImage for user-space install."
      }
      if (Get-Command sudo -ErrorAction SilentlyContinue) {
        & sudo dpkg -i $Path
      } else {
        & dpkg -i $Path
      }
      return
    }
    if ($lower.EndsWith(".appimage")) {
      $targetDir = if ($env:SDM_CLICKHOUSE_APPIMAGE_DIR) { $env:SDM_CLICKHOUSE_APPIMAGE_DIR } else { Join-Path $HOME ".local/bin" }
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
      $targetPath = Join-Path $targetDir "sdm-clickhouse.AppImage"
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
    $destination = if ($SystemInstallMode) { "/Applications/" } else { (Join-Path $HOME "Applications") }
    if (-not (Test-Path $destination)) {
      New-Item -ItemType Directory -Path $destination -Force | Out-Null
    }
    Copy-Item -Recurse -Force -Path $app.FullName -Destination $destination
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

$headers = @{ Accept = "application/vnd.github+json" }
if ($GitHubToken) {
  $headers.Authorization = "Bearer $GitHubToken"
}

$release = $null
$asset = $null

if ($Version -eq "latest") {
  $releaseUrl = "https://api.github.com/repos/$Repo/releases?per_page=20"
  Write-Host "Resolving release metadata from $releaseUrl"
  $candidates = Invoke-GitHubApi -Url $releaseUrl -Headers $headers
  foreach ($candidate in $candidates) {
    if ($candidate.draft -or $candidate.prerelease) { continue }
    $candidateAsset = Select-Asset -Assets $candidate.assets -OsName $osName -ArchName $archName
    if ($null -eq $candidateAsset) { continue }
    $candidateDigest = [string]$candidateAsset.digest
    if (-not $candidateDigest.StartsWith("sha256:")) { continue }
    $release = $candidate
    $asset = $candidateAsset
    break
  }
  if ($null -eq $release -or $null -eq $asset) {
    throw "No compatible release asset found for $osName/$archName."
  }
} else {
  $tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
  $releaseUrl = "https://api.github.com/repos/$Repo/releases/tags/$tag"
  Write-Host "Resolving release metadata from $releaseUrl"
  $release = Invoke-GitHubApi -Url $releaseUrl -Headers $headers
  $asset = Select-Asset -Assets $release.assets -OsName $osName -ArchName $archName
  if ($null -eq $asset) {
    throw "No compatible release asset found for $osName/$archName in tag $tag."
  }
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

Install-Asset -Path $tmpPath -AssetName $asset.name -OsName $osName -SystemInstallMode $SystemInstall.IsPresent

Write-Host "SDM ClickHouse installation complete."

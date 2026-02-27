param(
  [string]$Version = $(if ($env:SDM_CLICKHOUSE_VERSION) { $env:SDM_CLICKHOUSE_VERSION } else { "latest" }),
  [string]$Repo = $(if ($env:SDM_CLICKHOUSE_REPO) { $env:SDM_CLICKHOUSE_REPO } else { "lord007tn/sdm-clickhouse" }),
  [string]$GitHubToken = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } elseif ($env:GH_TOKEN) { $env:GH_TOKEN } else { "" }),
  [switch]$SystemInstall,
  [switch]$Portable,
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

function Test-Truthy {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  $normalized = $Value.Trim().ToLowerInvariant()
  return $normalized -in @("1", "true", "yes", "on")
}

function Select-Asset {
  param(
    [array]$Assets,
    [string]$OsName,
    [string]$ArchName,
    [bool]$PreferPortable = $false
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
    if ($PreferPortable) {
      if ($ArchName -eq "arm64") {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".zip") -and $n.Contains("portable") -and ($n.Contains("arm64") -or $n.Contains("aarch64")) }),
          (Find-Asset { param($n) $n.EndsWith(".zip") -and $n.Contains("portable") })
        )
      } else {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".zip") -and $n.Contains("portable") -and ($n.Contains("x64") -or $n.Contains("amd64")) }),
          (Find-Asset { param($n) $n.EndsWith(".zip") -and $n.Contains("portable") })
        )
      }
      if ($null -ne $portableAsset) { return $portableAsset }
    }
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
    if ($PreferPortable) {
      if ($ArchName -eq "arm64") {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("aarch64") }),
          (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("arm64") }),
          (Find-Asset { param($n) $n.EndsWith(".appimage") })
        )
      } else {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("amd64") }),
          (Find-Asset { param($n) $n.EndsWith(".appimage") -and $n.Contains("x64") }),
          (Find-Asset { param($n) $n.EndsWith(".appimage") })
        )
      }
      if ($null -ne $portableAsset) { return $portableAsset }
    }
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
    if ($PreferPortable) {
      if ($ArchName -eq "arm64") {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".app.tar.gz") -and ($n.Contains("aarch64") -or $n.Contains("arm64")) }),
          (Find-Asset { param($n) $n.EndsWith(".app.tar.gz") })
        )
      } else {
        $portableAsset = First-Asset @(
          (Find-Asset { param($n) $n.EndsWith(".app.tar.gz") -and ($n.Contains("x64") -or $n.Contains("amd64")) }),
          (Find-Asset { param($n) $n.EndsWith(".app.tar.gz") })
        )
      }
      if ($null -ne $portableAsset) { return $portableAsset }
    }
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
    [bool]$SystemInstallMode = $false,
    [bool]$PortableMode = $false
  )

  $lower = $AssetName.ToLowerInvariant()

  if ($OsName -eq "windows") {
    if ($lower.EndsWith(".zip") -and ($PortableMode -or $lower.Contains("portable"))) {
      $targetDir = if ($env:SDM_CLICKHOUSE_PORTABLE_DIR) {
        $env:SDM_CLICKHOUSE_PORTABLE_DIR
      } else {
        Join-Path $HOME "sdm-clickhouse-portable"
      }
      New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
      Expand-Archive -LiteralPath $Path -DestinationPath $targetDir -Force

      $portableExe = Get-ChildItem -Path $targetDir -Filter *.exe -File -Recurse |
        Where-Object { $_.Name.ToLowerInvariant().Contains("sdm") -and $_.Name.ToLowerInvariant().Contains("clickhouse") } |
        Select-Object -First 1
      if ($null -eq $portableExe) {
        $portableExe = Get-ChildItem -Path $targetDir -Filter *.exe -File -Recurse | Select-Object -First 1
      }

      Write-Host "Extracted portable package to $targetDir"
      if ($null -ne $portableExe) {
        Write-Host "Portable executable: $($portableExe.FullName)"
      } else {
        Write-Host "Portable executable not found automatically. Check extracted files in $targetDir"
      }
      return
    }
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
    if ($lower.EndsWith(".app.tar.gz")) {
      $extractDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sdm-clickhouse-portable-" + [guid]::NewGuid().ToString("N"))
      New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
      & tar -xzf $Path -C $extractDir
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to extract portable macOS app archive."
      }
      $app = Get-ChildItem -Path $extractDir -Filter *.app -Directory -Recurse | Select-Object -First 1
      if ($null -eq $app) {
        throw "No .app found in portable archive."
      }
      $destination = if ($SystemInstallMode) { "/Applications/" } else { (Join-Path $HOME "Applications") }
      if (-not (Test-Path $destination)) {
        New-Item -ItemType Directory -Path $destination -Force | Out-Null
      }
      if ($SystemInstallMode -and (Get-Command sudo -ErrorAction SilentlyContinue)) {
        & sudo cp -R $app.FullName $destination
      } else {
        Copy-Item -Recurse -Force -Path $app.FullName -Destination $destination
      }
      Write-Host "Installed $($app.Name) into $destination"
      return
    }

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
$portableMode = $Portable.IsPresent -or (Test-Truthy $env:SDM_CLICKHOUSE_PORTABLE)

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
    $candidateAsset = Select-Asset -Assets $candidate.assets -OsName $osName -ArchName $archName -PreferPortable $portableMode
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
  $asset = Select-Asset -Assets $release.assets -OsName $osName -ArchName $archName -PreferPortable $portableMode
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

Install-Asset -Path $tmpPath -AssetName $asset.name -OsName $osName -SystemInstallMode $SystemInstall.IsPresent -PortableMode $portableMode

Write-Host "SDM ClickHouse installation complete."

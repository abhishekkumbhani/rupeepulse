# Packaging script for RupeePulse Chrome Extension
# Reads version from manifest.json and produces a versioned zip

$manifest = Get-Content -Path (Join-Path $PSScriptRoot "manifest.json") -Raw | ConvertFrom-Json
$version = $manifest.version
$zipName = "RupeePulse-v$version.zip"
$outputZip = Join-Path $PSScriptRoot $zipName

# Remove previous build
if (Test-Path $outputZip) {
    Remove-Item -Force $outputZip
}

# Also clean older names if present
$oldZips = @("CurrencyPulse-Pro-v$version.zip", "CurrencyPulse-Pro.zip", "RupeePulse.zip")
foreach ($old in $oldZips) {
    $p = Join-Path $PSScriptRoot $old
    if (Test-Path $p) { Remove-Item -Force $p }
}

# Files to include in the distribution bundle
$filesToInclude = @(
    "manifest.json",
    "background.js",
    "offscreen.html",
    "offscreen.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "icons",
    "README.md",
    "LICENSE"
)

$tempDistDir = Join-Path $PSScriptRoot "dist_temp"
if (Test-Path $tempDistDir) {
    Remove-Item -Recurse -Force $tempDistDir
}
New-Item -ItemType Directory -Force -Path $tempDistDir | Out-Null

foreach ($item in $filesToInclude) {
    $src = Join-Path $PSScriptRoot $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $tempDistDir $item) -Recurse -Force
    } else {
        Write-Warning "  [SKIP] Not found: $item"
    }
}

Compress-Archive -Path "$tempDistDir\*" -DestinationPath $outputZip -CompressionLevel Optimal -Force
Remove-Item -Recurse -Force $tempDistDir

$sizeKB = [Math]::Round((Get-Item $outputZip).Length / 1KB, 1)
Write-Host ""
Write-Host "[OK] RupeePulse v$version packaged successfully"
Write-Host "  Output : $outputZip"
Write-Host "  Size   : $sizeKB KB"
Write-Host ""

param([string]$Output, [switch]$Launch)
$ErrorActionPreference = 'Stop'
if (-not $Output) {
  $Output = if ($Launch) { "$PSScriptRoot/dist/launch" } else { "$PSScriptRoot/dist/intake" }
}
$project = (Resolve-Path -LiteralPath "$PSScriptRoot/../..").Path
$target = [IO.Path]::GetFullPath($Output)
$outputRoot = [IO.Path]::GetFullPath("$PSScriptRoot/dist") + [IO.Path]::DirectorySeparatorChar
if (-not $target.StartsWith($outputRoot, [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $target)) {
  throw 'Choose a new output directory under backend/christmas/dist.'
}

$files = @(
  'css/tokens.css', 'css/base.css', 'css/utilities.css', 'css/components/button.css', 'css/pages/christmas.css',
  'js/components/christmas-controls.js', 'js/pages/christmas-case-workspace.js',
  'js/pages/christmas-management-tools.js', 'js/pages/platform-audit-view.js', 'js/services/christmas-api.js'
)
$sources = [ordered]@{
  'staff/index.html' = "$PSScriptRoot/staff/index.html"
  'js/christmas-intake.js' = "$PSScriptRoot/staff/christmas-intake.js"
  'js/staff-accounts.js' = "$PSScriptRoot/staff/staff-accounts.js"
  'js/staff-password.js' = "$PSScriptRoot/staff/staff-password.js"
}
foreach ($file in $files) { $sources[$file] = Join-Path $project $file }
if ($Launch) {
  foreach ($file in @('css/pages/dashboard.css', 'js/layouts/admin-layout.js', 'js/config/admin-config.js',
      'js/data/label-registry.js', 'js/data/venue-data.js', 'js/utils/runtime-message.js', 'js/config/environment.js',
      'js/pages/christmas-content-editor.js', 'js/components/brand-image-upload.js',
      'js/pages/admin-pages.js', 'js/pages/admin-login.js', 'js/utils/validator.js', 'js/router/admin-router.js')) {
    $sources[$file] = Join-Path $project $file
  }
  $sources['staff/login.html'] = "$PSScriptRoot/staff/login.html"
  $sources['staff/login.js'] = "$PSScriptRoot/staff/login.js"
  $sources['public-assets/css/pages/dashboard.css'] = Join-Path $project 'css/pages/dashboard.css'
  $sources['public-assets/js/pages/admin-login.js'] = Join-Path $project 'js/pages/admin-login.js'
  $publicFiles = @(
    'js/components/christmas-controls.js', 'js/services/christmas-api.js', 'js/data/christmas-content.js',
    'js/pages/christmas.js', 'js/pages/christmas-browse.js', 'js/pages/christmas-donor.js',
    'js/pages/christmas-account.js', 'js/pages/christmas-direct.js'
  )
  foreach ($file in $publicFiles) { $sources[$file] = Join-Path $project $file }
  $sources['js/pages/christmas-mailing.js'] = Join-Path $project 'js/pages/christmas-mailing.js'
  foreach ($file in ($files | Where-Object { $_.StartsWith('css/') }) + $publicFiles) {
    $sources['public-assets/' + $file] = Join-Path $project $file
  }
  $sources['public/index.html'] = "$PSScriptRoot/public/index.html"
  $sources['public/privacy.html'] = "$PSScriptRoot/public/privacy.html"
  $sources['public-assets/privacy-v1.0.md'] = "$PSScriptRoot/public/privacy-v1.0.md"
  $sources['public-assets/js/christmas-launch.js'] = "$PSScriptRoot/public/christmas-launch.js"
}
foreach ($source in $sources.Values) {
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing asset: $source" }
}
foreach ($relative in $sources.Keys) {
  $destination = Join-Path $target $relative
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
  Copy-Item -LiteralPath $sources[$relative] -Destination $destination
}
Write-Output $target

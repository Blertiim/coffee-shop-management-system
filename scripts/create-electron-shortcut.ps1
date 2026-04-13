param(
  [string]$AppName = "Coffee Shop POS",
  [string]$ShortcutPath = "",
  [string]$RepoRoot = "",
  [string]$ElectronExePath = ""
)

$resolvedRepoRoot = if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  (Resolve-Path $RepoRoot).Path
}

$resolvedElectronExePath = if ([string]::IsNullOrWhiteSpace($ElectronExePath)) {
  Join-Path $resolvedRepoRoot "node_modules\electron\dist\electron.exe"
} else {
  (Resolve-Path $ElectronExePath).Path
}

$frontendIndexPath = Join-Path $resolvedRepoRoot "frontend\dist\index.html"

if (-not (Test-Path $resolvedElectronExePath)) {
  throw "Electron executable was not found at '$resolvedElectronExePath'. Run npm install in the project root first."
}

if (-not (Test-Path $frontendIndexPath)) {
  throw "Frontend production build was not found at '$frontendIndexPath'. Run npm run build in the project root first."
}

$resolvedShortcutPath = if ([string]::IsNullOrWhiteSpace($ShortcutPath)) {
  Join-Path ([Environment]::GetFolderPath("Desktop")) "$AppName.lnk"
} else {
  $ShortcutPath
}

$shortcutDirectory = Split-Path -Parent $resolvedShortcutPath
if ($shortcutDirectory -and -not (Test-Path $shortcutDirectory)) {
  New-Item -ItemType Directory -Path $shortcutDirectory -Force | Out-Null
}

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($resolvedShortcutPath)
$shortcut.TargetPath = $resolvedElectronExePath
$shortcut.Arguments = "`"$resolvedRepoRoot`""
$shortcut.WorkingDirectory = $resolvedRepoRoot
$shortcut.WindowStyle = 1
$shortcut.Description = "Open the Coffee Shop POS desktop app"
$shortcut.IconLocation = "$resolvedElectronExePath,0"
$shortcut.Save()

Write-Output "Shortcut created: $resolvedShortcutPath"

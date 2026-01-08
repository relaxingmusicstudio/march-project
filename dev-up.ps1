$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$supabaseCli = Join-Path $root "supabase\\supabase.exe"
$supabaseCmd = if (Test-Path $supabaseCli) { $supabaseCli } else { "supabase" }

$portInUse = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portInUse) {
  Write-Host "[FAIL] Port 8080 is already in use. Close the process and rerun dev-up."
  exit 1
}

Write-Host "[INFO] Starting Supabase..."
& $supabaseCmd start
if ($LASTEXITCODE -ne 0) {
  Write-Host "[FAIL] supabase start failed."
  exit $LASTEXITCODE
}

if (!(Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "[INFO] node_modules missing. Running npm install..."
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] npm install failed."
    exit $LASTEXITCODE
  }
}

Write-Host "[INFO] Starting Vite dev server in a new terminal..."
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd `"$root`"; npm run dev"

Write-Host "Next: npm run seed:user"
Write-Host "Next: .\\dev-proof.ps1"
Write-Host "App: http://localhost:8080"

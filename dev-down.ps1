cd "$PSScriptRoot"
Write-Host "== DEV DOWN ==" -ForegroundColor Cyan

# Stop app servers
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Stop Supabase
supabase stop

Write-Host "✅ Safe shutdown complete." -ForegroundColor Green

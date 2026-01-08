cd "$PSScriptRoot"
Write-Host "== DEV CHECK ==" -ForegroundColor Cyan

supabase status

# Try common dev ports in order and report the first that answers JSON
$ports = @(8080,8081,8082,8083,8084)
foreach ($p in $ports) {
try {
$r = Invoke-RestMethod -Uri "http://localhost:$p/api/health" -TimeoutSec 3
Write-Host "✅ API OK on :$p" -ForegroundColor Green
$r | Out-String | Write-Host
exit 0
} catch { }
}
Write-Host "⚠️ API health not responding on 8080-8084 (app may not be running)" -ForegroundColor Yellow

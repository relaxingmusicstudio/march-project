cd "$PSScriptRoot"
Write-Host "== DEV NUKE (LAST RESORT) ==" -ForegroundColor Red
Write-Host "This removes ALL supabase containers for this machine session." -ForegroundColor Yellow

docker ps -a --filter "name=supabase" --format "{{.ID}}" | ForEach-Object { docker rm -f $_ }
docker system prune -f

Write-Host "Now run: supabase start" -ForegroundColor Cyan

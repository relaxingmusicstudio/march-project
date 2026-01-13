$patterns = @(
"AWS_ACCESS_KEY_ID",
"AWS_SECRET_ACCESS_KEY",
"SUPABASE_SERVICE_ROLE_KEY",
"SUPABASE_ANON_KEY",
"OPENAI_API_KEY",
"GEMINI_API_KEY",
"STRIPE_SECRET_KEY",
"STRIPE_WEBHOOK_SECRET",
"TWILIO_AUTH_TOKEN",
"RESEND_API_KEY",
"Authorization:",
"Bearer "
)

$excludedDirs = @(
"\node_modules\",
"\.vercel\",
"\dist\",
"\build\",
"\coverage\",
"\test-results\",
"\.next\",
"\out\"
)

Get-ChildItem -Recurse -File |
Where-Object {
$path = $_.FullName
-not ($excludedDirs | Where-Object { $path -like "*$_*" })
} |
Select-String -Pattern $patterns -SimpleMatch -ErrorAction SilentlyContinue |
ForEach-Object {
"{0}:{1} -> {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
} |
Set-Content .\secret-scan.log

Write-Host "Scan complete (source-only). Results saved to secret-scan.log"

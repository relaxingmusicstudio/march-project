$ErrorActionPreference = "Continue"
$failed = $false

function Write-Pass($message) {
  Write-Host "[PASS] $message"
}

function Write-Fail($message) {
  Write-Host "[FAIL] $message"
  $script:failed = $true
}

function Get-EnvValueFromFile($path, $key) {
  if (!(Test-Path $path)) {
    return $null
  }
  $line = Get-Content -Path $path | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if (!$line) {
    return $null
  }
  $parts = $line -split "=", 2
  if ($parts.Count -lt 2) {
    return $null
  }
  $value = $parts[1].Trim()
  if ($value) {
    return $value
  }
  return $null
}

function Has-EnvValue($key) {
  $envValue = (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue).Value
  if ($envValue) {
    return $true
  }
  $localValue = Get-EnvValueFromFile -path ".env.local" -key $key
  if ($localValue) {
    return $true
  }
  $rootValue = Get-EnvValueFromFile -path ".env" -key $key
  if ($rootValue) {
    return $true
  }
  return $false
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$supabaseCli = Join-Path $root "supabase\\supabase.exe"
$supabaseCmd = if (Test-Path $supabaseCli) { $supabaseCli } else { "supabase" }

try {
  $statusOutput = & $supabaseCmd status 2>&1
  if ($LASTEXITCODE -eq 0 -and ($statusOutput -match "running") -and ($statusOutput -notmatch "not running")) {
    Write-Pass "supabase status (running)"
  } else {
    Write-Fail "supabase status not running. Run: .\\dev-up.ps1"
  }
} catch {
  Write-Fail "supabase status failed. Run: .\\dev-up.ps1"
}

try {
  $health = Invoke-RestMethod -Method Get -Uri "http://localhost:8080/api/health" -TimeoutSec 5
  if ($null -ne $health) {
    Write-Pass "API health returns JSON"
  } else {
    Write-Fail "API health returned empty response. Start the app: npm run dev"
  }
} catch {
  Write-Fail "API health unreachable. Start the app: npm run dev"
}

try {
  $dbResponse = Invoke-WebRequest -Method Get -Uri "http://localhost:54321/rest/v1/" -TimeoutSec 5 -ErrorAction Stop
  if ($dbResponse.StatusCode -ge 200 -and $dbResponse.StatusCode -lt 500) {
    Write-Pass "DB reachable (REST endpoint)"
  } else {
    Write-Fail "DB reachable check failed. Start Supabase: .\\dev-up.ps1"
  }
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  if ($statusCode -eq 401 -or $statusCode -eq 403) {
    Write-Pass "DB reachable (REST endpoint requires auth)"
  } else {
    Write-Fail "DB reachable check failed. Start Supabase: .\\dev-up.ps1"
  }
}

$requiredEnv = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY")
$missing = @()
foreach ($key in $requiredEnv) {
  if (!(Has-EnvValue $key)) {
    $missing += $key
  }
}
if ($missing.Count -eq 0) {
  Write-Pass "Auth configured (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)"
} else {
  Write-Fail ("Auth configured missing: " + ($missing -join ", ") + ". Set in .env.local")
}

try {
  $appResponse = Invoke-WebRequest -Method Get -Uri "http://localhost:8080" -TimeoutSec 5 -ErrorAction Stop
  if ($appResponse.StatusCode -eq 200) {
    Write-Pass "App page reachable"
  } else {
    Write-Fail "App page not reachable. Start the app: npm run dev"
  }
} catch {
  Write-Fail "App page unreachable. Start the app: npm run dev"
}

if ($failed) {
  exit 1
}
exit 0

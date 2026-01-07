$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$proofRoot = Join-Path $repoRoot "proof/latest"
$rawRoot = Join-Path $proofRoot "raw"
$null = New-Item -ItemType Directory -Force -Path $rawRoot

$startAt = Get-Date
$steps = @()
$failed = $false
$contractPath = Join-Path $repoRoot "contracts/v17.1.guardrails.json"
$contractLoaded = $false
$contract = $null
$script:dbCredsAvailable = $false

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    $existing = [Environment]::GetEnvironmentVariable($key, "Process")
    if (-not $existing) {
      [Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
  }
}

Import-DotEnv -Path (Join-Path $repoRoot ".env")

$dbPasswordEnv = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD", "Process")
$dbAccessTokenEnv = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "Process")
$script:dbCredsAvailable = [bool]($dbPasswordEnv -or $dbAccessTokenEnv)

if (Test-Path $contractPath) {
  try {
    $contract = Get-Content $contractPath -Raw | ConvertFrom-Json
    $contractLoaded = $true
  } catch {
    $contractLoaded = $false
  }
}

function Add-StepResult {
  param(
    [string]$Name,
    [string]$Status,
    [string]$Command,
    [string]$OutFile,
    [int]$ExitCode,
    [string]$Notes
  )
  $script:steps += [ordered]@{
    name = $Name
    status = $Status
    command = $Command
    exit_code = $ExitCode
    output = ("raw/" + $OutFile)
    notes = $Notes
  }
  if ($Status -eq "fail") {
    $script:failed = $true
  }
}

function Add-SkipStep {
  param(
    [string]$Name,
    [string]$Command,
    [string]$OutFile,
    [string]$Notes
  )
  $outPath = Join-Path $rawRoot $OutFile
  $skipNote = if ($Notes) { $Notes } else { "skipped" }
  "SKIP: $skipNote" | Out-File -FilePath $outPath -Encoding utf8
  Add-StepResult -Name $Name -Status "skip" -Command $Command -OutFile $OutFile -ExitCode 0 -Notes $skipNote
}

function Run-Command {
  param(
    [string]$Name,
    [string]$Command,
    [scriptblock]$Action,
    [string]$OutFile
  )
  $outPath = Join-Path $rawRoot $OutFile
  $exitCode = 0
  $status = "pass"
  try {
    & $Action 2>&1 | Tee-Object -FilePath $outPath | Out-Null
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
    if ($exitCode -ne 0) { $status = "fail" }
  } catch {
    $_ | Out-File -FilePath $outPath -Encoding utf8
    $exitCode = 1
    $status = "fail"
  }
  Add-StepResult -Name $Name -Status $status -Command $Command -OutFile $OutFile -ExitCode $exitCode -Notes ""
}

function Run-SupabaseDbPush {
  param([string]$OutFile)
  $outPath = Join-Path $rawRoot $OutFile
  $password = [Environment]::GetEnvironmentVariable("SUPABASE_DB_PASSWORD", "Process")
  $accessToken = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "Process")
  $commandLabel = ".\\supabase\\supabase.exe db push --yes"
  $commandArgs = @("db", "push", "--yes")
  if (-not $script:dbCredsAvailable) {
    Add-SkipStep -Name "supabase db push" -Command $commandLabel -OutFile $OutFile -Notes "no DB credentials provided (local proof mode)"
    return $false
  }
  if ($password) {
    $commandArgs += @("--password", $password)
    $commandLabel = ".\\supabase\\supabase.exe db push --yes --password `$env:SUPABASE_DB_PASSWORD"
  }

  $exitCode = 0
  $status = "pass"
  $notes = ""
  try {
    & .\supabase\supabase.exe @commandArgs 2>&1 | Tee-Object -FilePath $outPath | Out-Null
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
    if ($exitCode -ne 0) { $status = "fail" }
  } catch {
    $_ | Out-File -FilePath $outPath -Encoding utf8
    $exitCode = 1
    $status = "fail"
  }

  if ($status -eq "fail" -and -not $accessToken -and -not $password) {
    $notes = "missing Supabase auth: run `supabase login` or set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD"
  }

  Add-StepResult -Name "supabase db push" -Status $status -Command $commandLabel -OutFile $OutFile -ExitCode $exitCode -Notes $notes
  return ($status -eq "pass")
}

function Invoke-RpcCheck {
  param(
    [string]$Name,
    [string]$RpcName,
    [hashtable]$Payload,
    [scriptblock]$Validate,
    [string]$OutFile
  )
  $outPath = Join-Path $rawRoot $OutFile
  $sbUrl = if ($env:SUPABASE_URL) { $env:SUPABASE_URL } else { $env:VITE_SUPABASE_URL }
  $sbKey = if ($env:SUPABASE_ANON_KEY) { $env:SUPABASE_ANON_KEY } else { $env:VITE_SUPABASE_ANON_KEY }

  if (-not $sbUrl -or -not $sbKey) {
    "NOT RUN: missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY" |
      Out-File -FilePath $outPath -Encoding utf8
    Add-StepResult -Name $Name -Status "fail" -Command $RpcName -OutFile $OutFile -ExitCode 1 -Notes "missing Supabase env"
    return $false
  }

  $headers = @{
    apikey = $sbKey
    Authorization = "Bearer $sbKey"
  }
  $body = $Payload | ConvertTo-Json -Depth 10
  $response = $null
  $ok = $false
  $notes = ""
  try {
    $response = Invoke-RestMethod -Method Post -Uri "$sbUrl/rest/v1/rpc/$RpcName" -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20
    $ok = & $Validate $response
  } catch {
    $notes = $_.Exception.Message
    $ok = $false
  }

  $logLines = @(
    "rpc: $RpcName",
    "payload: $body",
    "response: " + ($response | ConvertTo-Json -Depth 10)
  )
  if ($notes) { $logLines += "error: $notes" }
  $logLines | Out-File -FilePath $outPath -Encoding utf8

  Add-StepResult -Name $Name -Status ($(if ($ok) { "pass" } else { "fail" })) -Command $RpcName -OutFile $OutFile -ExitCode ($(if ($ok) { 0 } else { 1 })) -Notes $notes
  return $ok
}

function Get-DevBaseFromLogs {
  $logCandidates = @(
    (Join-Path $repoRoot "vercel-dev.log"),
    (Join-Path $repoRoot "vite-dev.log"),
    (Join-Path $repoRoot "dev.log"),
    (Join-Path $repoRoot "npm-debug.log"),
    (Join-Path $repoRoot "proofgate-local.txt")
  )
  $logFiles = $logCandidates |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-Item $_ } |
    Sort-Object LastWriteTime -Descending

  foreach ($file in $logFiles) {
    try {
      $content = Get-Content $file.FullName -Raw
    } catch {
      continue
    }

    if ($content -match "http://localhost:(\\d{2,5})") {
      return [ordered]@{
        base_url = "http://localhost:$($Matches[1])"
        path = $file.FullName
      }
    }

    if ($content -match "http://127\\.0\\.0\\.1:(\\d{2,5})") {
      return [ordered]@{
        base_url = "http://127.0.0.1:$($Matches[1])"
        path = $file.FullName
      }
    }
  }

  return $null
}

function Invoke-ApiHealth {
  param(
    [string]$BaseUrl,
    [int]$TimeoutSec = 5
  )
  $result = [ordered]@{
    base_url = $BaseUrl
    status_code = $null
    body = $null
    error = $null
    is_json = $false
    has_status = $false
    status_value = $null
    ok = $false
  }
  $uri = "$BaseUrl/api/health"
  try {
    $resp = Invoke-WebRequest -Method Get -Uri $uri -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
    $result.status_code = $resp.StatusCode
    $result.body = $resp.Content
  } catch {
    $result.error = $_.Exception.Message
    $resp = $_.Exception.Response
    if ($resp -and $resp -is [System.Net.HttpWebResponse]) {
      $result.status_code = [int]$resp.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $result.body = $reader.ReadToEnd()
        $reader.Close()
      } catch {
      }
    }
  }

  if ($result.body) {
    try {
      $json = $result.body | ConvertFrom-Json -ErrorAction Stop
      $result.is_json = $true
      $statusProp = $json.PSObject.Properties["status"]
      if ($statusProp) {
        $result.has_status = $true
        $result.status_value = [string]$json.status
        $result.ok = $result.status_value -eq "ok"
      }
    } catch {
    }
  }

  return $result
}

Run-Command -Name "git status --short" -Command "git status --short" -Action { git status --short } -OutFile "git_status.txt"
Run-SupabaseDbPush -OutFile "supabase_db_push.txt"

$typeName = "public.app_role"
if ($contractLoaded -and $contract.required_db -and $contract.required_db.types -and $contract.required_db.types.Count -gt 0) {
  $typeName = $contract.required_db.types[0].name
}
if (-not $script:dbCredsAvailable) {
  Add-SkipStep -Name "db app_role type" -Command "db_to_regtype" -OutFile "db_app_role.txt" -Notes "no DB credentials provided (local proof mode)"
  Add-SkipStep -Name "db has_role signature" -Command "db_to_regprocedure" -OutFile "db_has_role_sig.txt" -Notes "no DB credentials provided (local proof mode)"
} else {
  Invoke-RpcCheck -Name "db app_role type" -RpcName "db_to_regtype" -Payload @{ p_name = $typeName } -Validate { param($resp) return -not [string]::IsNullOrEmpty($resp) } -OutFile "db_app_role.txt"

  $hasRoleSig = "public.has_role(text, uuid)"
  Invoke-RpcCheck -Name "db has_role signature" -RpcName "db_to_regprocedure" -Payload @{ p_name = $hasRoleSig } -Validate { param($resp) return -not [string]::IsNullOrEmpty($resp) } -OutFile "db_has_role_sig.txt"
}

$tableList = @("public.visitors", "public.action_logs", "public.ceo_conversations", "public.onboarding_state")
if ($contractLoaded -and $contract.required_db -and $contract.required_db.tables) {
  $tableList = @($contract.required_db.tables)
}

$tablesOut = Join-Path $rawRoot "db_tables.txt"
$tablesOk = $true
$tableLines = @()
foreach ($table in $tableList) {
  $outFile = "db_table_" + ($table -replace '[^a-zA-Z0-9]+','_') + ".txt"
  if (-not $script:dbCredsAvailable) {
    Add-SkipStep -Name ("db table " + $table) -Command "db_to_regclass" -OutFile $outFile -Notes "no DB credentials provided (local proof mode)"
    $tableLines += "$table -> SKIP"
    continue
  }
  $ok = Invoke-RpcCheck -Name ("db table " + $table) -RpcName "db_to_regclass" -Payload @{ p_name = $table } -Validate { param($resp) return -not [string]::IsNullOrEmpty($resp) } -OutFile $outFile
  $tableLines += "$table -> $ok"
  if (-not $ok) { $tablesOk = $false }
}
$tableLines | Out-File -FilePath $tablesOut -Encoding utf8

$pkgPath = Join-Path $repoRoot "package.json"
$pkg = $null
try {
  $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
} catch {
  $pkg = $null
}

if ($pkg -and $pkg.scripts) {
  if ($pkg.scripts.lint) { Run-Command -Name "npm run lint" -Command "npm run lint" -Action { npm run lint } -OutFile "npm_lint.txt" }
  if ($pkg.scripts.typecheck) { Run-Command -Name "npm run typecheck" -Command "npm run typecheck" -Action { npm run typecheck } -OutFile "npm_typecheck.txt" }
  if ($pkg.scripts.test) { Run-Command -Name "npm test" -Command "npm test" -Action { npm test } -OutFile "npm_test.txt" }
  if ($pkg.scripts.build) { Run-Command -Name "npm run build" -Command "npm run build" -Action { npm run build } -OutFile "npm_build.txt" }
} else {
  Add-StepResult -Name "npm scripts" -Status "fail" -Command "package.json parse" -OutFile "npm_scripts.txt" -ExitCode 1 -Notes "package.json unreadable"
}

$apiOut = Join-Path $rawRoot "api_smoke.txt"
$apiAttempts = @()
$apiResults = @()
$apiSource = ""
$apiExplicit = $false

if ($env:DEV_BASE_URL) {
  $apiAttempts = @($env:DEV_BASE_URL)
  $apiSource = "env:DEV_BASE_URL"
  $apiExplicit = $true
} elseif ($env:VITE_PORT) {
  $apiAttempts = @("http://localhost:$($env:VITE_PORT)")
  $apiSource = "env:VITE_PORT"
  $apiExplicit = $true
} else {
  $logInfo = Get-DevBaseFromLogs
  if ($logInfo) {
    $apiAttempts += $logInfo.base_url
    $apiSource = "log:$($logInfo.path)"
  }
  $apiAttempts += @("http://localhost:8080", "http://localhost:5173", "http://localhost:3000")
}

$apiAttempts = @($apiAttempts)
$apiSeen = @{}
$apiUnique = New-Object System.Collections.Generic.List[string]
foreach ($item in $apiAttempts) {
  if (-not $item) { continue }
  $value = [string]$item
  if ($apiSeen.ContainsKey($value)) { continue }
  $apiSeen[$value] = $true
  $apiUnique.Add($value) | Out-Null
}
$apiAttempts = $apiUnique
$selected = $null
$apiOk = $false
$apiStatus = "skip"
$apiNotes = ""
if ($apiExplicit) {
  if ($apiAttempts.Count -gt 0) {
    $result = Invoke-ApiHealth -BaseUrl $apiAttempts[0] -TimeoutSec 5
    $apiResults += $result
    $selected = $result
    if (-not $result.is_json) {
      $apiStatus = "fail"
      $apiNotes = "no_json_response_from_explicit_base_url"
    } elseif (-not $result.has_status) {
      $apiStatus = "fail"
      $apiNotes = "missing_status_field"
    } elseif (-not $result.ok) {
      $apiStatus = "fail"
      $apiNotes = "health_status_not_ok"
    } else {
      $apiOk = $true
      $apiStatus = "pass"
    }
  } else {
    $apiStatus = "fail"
    $apiNotes = "missing_explicit_base_url"
  }
} else {
  foreach ($candidate in $apiAttempts) {
    $result = Invoke-ApiHealth -BaseUrl $candidate -TimeoutSec 5
    $apiResults += $result
    if ($result.is_json -and $result.has_status) {
      $selected = $result
      break
    }
  }

  if ($selected) {
    $apiOk = $selected.ok
    $apiStatus = if ($apiOk) { "pass" } else { "fail" }
    if (-not $apiOk) { $apiNotes = "health_status_not_ok" }
  } else {
    $apiStatus = "skip"
    $apiNotes = "NOT RUN: no dev server detected"
  }
}

$apiCommand = if ($selected) { "$($selected.base_url)/api/health" } elseif ($apiAttempts.Count -gt 0) { "$($apiAttempts[0])/api/health" } else { "auto-detect" }

$logLines = @()
$logLines += "attempted_base_urls:"
if ($apiResults.Count -eq 0) {
  $logLines += "- (none)"
} else {
  foreach ($entry in $apiResults) {
    $logLines += "- $($entry.base_url) status=$($entry.status_code) json=$($entry.is_json) has_status=$($entry.has_status) ok=$($entry.ok)"
    if ($entry.body) { $logLines += "  body: $($entry.body)" }
    if ($entry.error) { $logLines += "  error: $($entry.error)" }
  }
}
$logLines += "chosen_base_url: " + ($(if ($selected) { $selected.base_url } else { "" }))
$logLines += "source: $apiSource"
$logLines += "status: $apiStatus"
$logLines += "notes: $apiNotes"
$logLines | Out-File -FilePath $apiOut -Encoding utf8

$apiExit = if ($apiStatus -eq "fail") { 1 } else { 0 }
Add-StepResult -Name "api smoke check" -Status $apiStatus -Command $apiCommand -OutFile "api_smoke.txt" -ExitCode $apiExit -Notes $apiNotes

$status = if ($failed) { "fail" } else { "pass" }
$endAt = Get-Date

$proof = [ordered]@{
  mode = "full"
  started_at = $startAt.ToString("o")
  finished_at = $endAt.ToString("o")
  status = $status
  contract = @{
    path = "contracts/v17.1.guardrails.json"
    loaded = $contractLoaded
  }
  steps = $steps
  notes = @(
    "TODO: extend checks to be fully contract-driven."
  )
}

$proof | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $proofRoot "proof.json") -Encoding utf8

$mdLines = @(
  "# Proof Report (full)",
  "Status: $($status.ToUpper())",
  "Started: $($startAt.ToString("u"))",
  "Finished: $($endAt.ToString("u"))",
  "",
  "Steps:"
)

foreach ($step in $steps) {
  $line = "- [$($step.status.ToUpper())] $($step.name) ($($step.output))"
  if ($step.notes) {
    $line = "$line - $($step.notes)"
  }
  $mdLines += $line
}

$mdLines | Out-File -FilePath (Join-Path $proofRoot "proof.md") -Encoding utf8

if ($failed) { exit 1 }
exit 0

# Roda os testes no Chrome headless (não precisa de Node).
# Uso:  powershell -ExecutionPolicy Bypass -File tests\run.ps1
$ErrorActionPreference = 'Stop'
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Error 'Chrome não encontrado.' }

$profile = Join-Path $env:TEMP 'etq-tests-profile'
$failed = $false
foreach ($name in @('run.html', 'guard.html', 'orphan.html', 'native.html')) {
  $page = (Resolve-Path (Join-Path $PSScriptRoot $name)).Path
  $url = 'file:///' + ($page -replace '\\', '/')
  # O Chrome escreve avisos no stderr; no PowerShell 5.1 isso viraria erro fatal com 'Stop'.
  $ErrorActionPreference = 'Continue'
  $html = & $chrome --headless=new --disable-gpu --no-first-run --user-data-dir="$profile" `
    --allow-file-access-from-files --virtual-time-budget=20000 --dump-dom $url 2>$null | Out-String
  $ErrorActionPreference = 'Stop'

  Write-Output "== $name"
  if ($html -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Output 'Não consegui ler o resultado.'; $failed = $true; continue }
  $out = [System.Net.WebUtility]::HtmlDecode($Matches[1])
  Write-Output $out
  if ($out -notmatch 'RESULTADO: OK') { $failed = $true }
}
if ($failed) { exit 1 }

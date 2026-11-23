# Roda os testes no Chrome headless (não precisa de Node).
# Uso:  powershell -ExecutionPolicy Bypass -File tests\run.ps1
$ErrorActionPreference = 'Stop'
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { Write-Error 'Chrome não encontrado.' }

$page = (Resolve-Path (Join-Path $PSScriptRoot 'run.html')).Path
$url = 'file:///' + ($page -replace '\\', '/')
$profile = Join-Path $env:TEMP 'etq-tests-profile'

# O Chrome escreve avisos no stderr; no PowerShell 5.1 isso viraria erro fatal com 'Stop'.
$ErrorActionPreference = 'Continue'
$html = & $chrome --headless=new --disable-gpu --no-first-run --user-data-dir="$profile" `
  --allow-file-access-from-files --virtual-time-budget=20000 --dump-dom $url 2>$null | Out-String
$ErrorActionPreference = 'Stop'

if ($html -notmatch '(?s)<pre id="out">(.*?)</pre>') { Write-Error 'Não consegui ler o resultado dos testes.' }
$out = [System.Net.WebUtility]::HtmlDecode($Matches[1])
Write-Output $out
if ($out -notmatch 'RESULTADO: OK') { exit 1 }

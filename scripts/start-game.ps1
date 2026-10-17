param([int]$Port = 4173, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectDir
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    throw 'Node.js 20.19+ or 22.12+ is required. Install Node.js, then launch again.'
}
if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'dist\index.html'))) {
    if (-not $npmCommand) { throw 'npm is required to build the source download.' }
    if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules\vite\bin\vite.js'))) {
        & $npmCommand.Source ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    & $npmCommand.Source run build
    if ($LASTEXITCODE -ne 0) { throw 'Game build failed.' }
}
$gameUrl = 'http://127.0.0.1:' + $Port + '/'
$ready = $false
try {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    if ($response.Content -match '<title>Agent') { $ready = $true }
    else { throw 'This port is used by another application. Choose another port.' }
} catch [System.Net.WebException] { }
if (-not $ready) {
    $gameProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList @(
        ('"' + (Join-Path $projectDir 'scripts\serve-game.mjs') + '"'), $Port
    ) -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($gameProcess.HasExited) { throw 'Game server could not start. Check whether the port is already used.' }
        Start-Sleep -Milliseconds 150
        try {
            $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
            if ($response.Content -match '<title>Agent') { $ready = $true; break }
        } catch [System.Net.WebException] { }
    }
}
if (-not $ready) { throw 'The local game server did not become ready.' }
Write-Host ('Agent Spire is ready: ' + $gameUrl)
if (-not $NoBrowser) { Start-Process $gameUrl }

$ErrorActionPreference = 'Stop'
$deploymentDirectory = Split-Path -Parent $PSScriptRoot
$configurationFile = Join-Path $deploymentDirectory 'config.json'
$configuration = Get-Content -LiteralPath $configurationFile -Raw | ConvertFrom-Json
$lockFile = Join-Path $deploymentDirectory 'agent.lock'
if (Test-Path -LiteralPath $lockFile) {
    $agentLock = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
    if (Get-Process -Id $agentLock.pid -ErrorAction SilentlyContinue) {
        Write-Output 'El agente de NutriBalance ya está activo.'
        return
    }
}
$agentFile = Join-Path $PSScriptRoot 'agent.mjs'
$agentProcess = Start-Process -FilePath $configuration.node -ArgumentList @(('"' + $agentFile + '"'), '--config', ('"' + $configurationFile + '"')) -WorkingDirectory $deploymentDirectory -RedirectStandardOutput (Join-Path $deploymentDirectory 'agent-out.log') -RedirectStandardError (Join-Path $deploymentDirectory 'agent-error.log') -WindowStyle Hidden -PassThru
Write-Output ('Agente de NutriBalance iniciado: ' + $agentProcess.Id)

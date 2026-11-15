[CmdletBinding()]
param(
    [string]$WorkspaceRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [switch]$Autostart,
    [switch]$Start
)
$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path.TrimEnd('\')
$frontendDirectory = Join-Path $taskWorkspace 'frontend'
$backendDirectory = Join-Path $taskWorkspace 'backend'
$backendEnvironment = Join-Path $backendDirectory '.env'
$frontendEnvironment = Join-Path $frontendDirectory '.env.local'
foreach ($requiredFile in @($backendEnvironment, $frontendEnvironment)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) { throw "Falta el archivo privado $requiredFile" }
}
$deploymentDirectory = Join-Path $taskWorkspace 'deployment'
$operationsDirectory = Join-Path $deploymentDirectory 'ops'
New-Item -ItemType Directory -Path $operationsDirectory -Force | Out-Null
$nodeFile = (Get-Command node -ErrorAction Stop).Source
$nodeDirectory = Split-Path -Parent $nodeFile
$npmFile = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm\node_modules\npm\bin\npm-cli.js'
if (-not (Test-Path -LiteralPath $npmFile)) { $npmFile = Join-Path $nodeDirectory 'node_modules\npm\bin\npm-cli.js' }
$corepackFile = Join-Path $nodeDirectory 'node_modules\corepack\dist\corepack.js'
foreach ($requiredFile in @($npmFile, $corepackFile)) { if (-not (Test-Path -LiteralPath $requiredFile)) { throw "Falta la herramienta $requiredFile" } }
$frontendRevision = (& git -C $frontendDirectory rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar el frontend.' }
$backendRevision = (& git -C $taskWorkspace rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'No se pudo identificar el backend.' }
$configuration = [ordered]@{
    root = $deploymentDirectory
    workspace = $taskWorkspace
    node = $nodeFile
    npmCli = $npmFile
    corepackCli = $corepackFile
    git = (Get-Command git -ErrorAction Stop).Source
    gh = (Get-Command gh -ErrorAction Stop).Source
    cloudflared = (Get-Command cloudflared -ErrorAction Stop).Source
    publicOrigin = 'https://api.neadev.com'
    backendEnv = $backendEnvironment
    frontendEnv = $frontendEnvironment
    postgresData = (Join-Path $backendDirectory '.local\postgres')
    postmanCollection = (Join-Path $taskWorkspace 'docs\api\NutriBalance.postman_collection.json')
    apiTunnelState = (Join-Path $frontendDirectory '.sites-runtime\expo\api-url.json')
    repositories = @{ frontend = 'Deathstone16/nutribalance-tp-web'; backend = 'Deathstone16/NutriBalanceExpress' }
    pollSeconds = 30
    initial = @{ frontend = @{ dir = $frontendDirectory; sha = $frontendRevision }; backend = @{ dir = $backendDirectory; sha = $backendRevision } }
}
$configuration | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $deploymentDirectory 'config.json') -Encoding utf8NoBOM
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'deployment-agent.mjs') -Destination (Join-Path $operationsDirectory 'agent.mjs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-deployment.ps1') -Destination (Join-Path $operationsDirectory 'start-agent.ps1') -Force
if ($Autostart) {
    $startupDirectory = [Environment]::GetFolderPath('Startup')
    $shellFile = (Get-Process -Id $PID).Path
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startupDirectory 'NutriBalance despliegue.lnk'))
    $shortcut.TargetPath = $shellFile
    $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $operationsDirectory 'start-agent.ps1') + '"'
    $shortcut.WorkingDirectory = $deploymentDirectory
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Write-Output 'Inicio automático configurado al entrar a Windows.'
}
if ($Start) { & (Join-Path $operationsDirectory 'start-agent.ps1') }
Write-Output 'Configuración preparada sin publicar secretos ni modificar las bases.'

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$saiNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$saiNodePath = if ($saiNodeCommand) { $saiNodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $saiNodePath)) {
    throw 'Node.js 22.13 이상을 설치한 뒤 다시 실행해 주세요. 자세한 내용은 README.md를 확인하세요.'
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\vinext'))) {
    throw '프로젝트 폴더에서 npm install을 먼저 실행해 주세요.'
}
& $saiNodePath (Join-Path $PSScriptRoot 'scripts\run-framework.mjs') dev
exit $LASTEXITCODE

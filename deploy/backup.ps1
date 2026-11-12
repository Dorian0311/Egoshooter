$ErrorActionPreference = 'Stop'
$backupRoot = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$backupName = 'altstadt-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
# pg_dump writes inside the container first; docker cp preserves binary data on Windows.
docker compose exec -T db pg_dump -U shooter -d shooter -Fc -f /tmp/shooter-backup.dump
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }
docker compose cp db:/tmp/shooter-backup.dump (Join-Path $backupRoot $backupName)
if ($LASTEXITCODE -ne 0) { throw 'Backup copy failed' }
Write-Output (Join-Path $backupRoot $backupName)

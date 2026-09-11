# Reset local PostgreSQL 16 "postgres" password (run PowerShell AS ADMINISTRATOR)
# Usage:
#   .\scripts\reset-postgres-password.ps1 -NewPassword "YourNewPasswordHere"

param(
  [Parameter(Mandatory = $true)]
  [string]$NewPassword
)

$ErrorActionPreference = "Stop"
$pgHba = "C:\Program Files\PostgreSQL\16\data\pg_hba.conf"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$service = "postgresql-x64-16"
$backup = "$pgHba.bak-square-market"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )) {
  throw "Run this script in PowerShell opened as Administrator."
}

if (-not (Test-Path $pgHba)) { throw "Missing $pgHba" }
if (-not (Test-Path $psql)) { throw "Missing $psql" }

Copy-Item $pgHba $backup -Force
Write-Host "Backup: $backup"

# Temporarily allow local login without password
$raw = Get-Content $pgHba -Raw
$trusted = $raw `
  -replace '(?m)^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256\s*$', '${1}trust' `
  -replace '(?m)^(host\s+all\s+all\s+::1/128\s+)scram-sha-256\s*$', '${1}trust' `
  -replace '(?m)^(local\s+all\s+all\s+)scram-sha-256\s*$', '${1}trust'
Set-Content -Path $pgHba -Value $trusted -Encoding ascii

Restart-Service $service -Force
Start-Sleep -Seconds 2

$escaped = $NewPassword.Replace("'", "''")
& $psql -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres WITH PASSWORD '$escaped';"
if ($LASTEXITCODE -ne 0) {
  Copy-Item $backup $pgHba -Force
  Restart-Service $service -Force
  throw "Failed to change password. Restored pg_hba.conf."
}

Copy-Item $backup $pgHba -Force
Restart-Service $service -Force
Write-Host "Password reset OK. Auth restored to scram-sha-256."
Write-Host "Next: tell Cursor your new password so we can finish Square Market DB setup."

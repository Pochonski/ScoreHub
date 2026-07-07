# start-botmundialista-pg.ps1
# Reanuda el servidor PostgreSQL Flexible Server de BotMundialista.
# Uso:
#   Manual:   .\start-botmundialista-pg.ps1
#   Programado: schtasks /create /tn "StartBotMundialistaPG" /tr "powershell -File C:\...\start-botmundialista-pg.ps1" /sc daily /st 07:00

$ErrorActionPreference = 'Continue'
Import-Module Az.Accounts -ErrorAction SilentlyContinue

if (-not (Get-AzContext -ErrorAction SilentlyContinue)) {
    Connect-AzAccount -UseDeviceAuthentication
}

$serverName = 'botmundialista-pg-srv'
$rg = 'botmundialista-rg'

try {
    $state = (Get-AzPostgreSqlFlexibleServer -ResourceGroupName $rg -Name $serverName -ErrorAction Stop).State
    if ($state -eq 'Stopped') {
        Start-AzPostgreSqlFlexibleServer -ResourceGroupName $rg -Name $serverName -ErrorAction Stop | Out-Null
        Write-Host "[OK] botmundialista-pg-srv: Stopped -> Starting" -ForegroundColor Green
    } elseif ($state -eq 'Starting') {
        Write-Host "[WAIT] botmundialista-pg-srv: aún iniciándose..." -ForegroundColor Yellow
    } else {
        Write-Host "[SKIP] botmundialista-pg-srv: ya está $state" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "[FAIL] botmundialista-pg-srv: $($_.Exception.Message.Split([Environment]::NewLine)[0])" -ForegroundColor Yellow
}
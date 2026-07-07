# stop-botmundialista-pg.ps1
# Detiene el servidor PostgreSQL Flexible Server de BotMundialista (ahorro nocturno).
# Uso:
#   Manual:   .\stop-botmundialista-pg.ps1
#   Programado: schtasks /create /tn "StopBotMundialistaPG" /tr "powershell -File C:\...\stop-botmundialista-pg.ps1" /sc daily /st 23:00

$ErrorActionPreference = 'Continue'
Import-Module Az.Accounts -ErrorAction SilentlyContinue

if (-not (Get-AzContext -ErrorAction SilentlyContinue)) {
    Connect-AzAccount -UseDeviceAuthentication
}

$serverName = 'botmundialista-pg-srv'
$rg = 'botmundialista-rg'

try {
    $state = (Get-AzPostgreSqlFlexibleServer -ResourceGroupName $rg -Name $serverName -ErrorAction Stop).State
    if ($state -eq 'Ready') {
        Stop-AzPostgreSqlFlexibleServer -ResourceGroupName $rg -Name $serverName -ErrorAction Stop | Out-Null
        Write-Host "[OK] botmundialista-pg-srv: Ready -> Stopped" -ForegroundColor Green
    } elseif ($state -eq 'Stopping') {
        Write-Host "[WAIT] botmundialista-pg-srv: aún parándose..." -ForegroundColor Yellow
    } else {
        Write-Host "[SKIP] botmundialista-pg-srv: ya está $state" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "[FAIL] botmundialista-pg-srv: $($_.Exception.Message.Split([Environment]::NewLine)[0])" -ForegroundColor Yellow
}
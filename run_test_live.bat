@echo off
REM Script de inicialização para Teste Live Completo (Windows)
REM Inicia: bot + dashboard + teste de validação em paralelo

setlocal enabledelayedexpansion

cls
echo.
echo.
echo  🚀 INICIANDO TESTE LIVE COMPLETO
echo  ==================================
echo.

REM Verificar .env
if not exist .env (
    echo  ⚠️  Arquivo .env nao encontrado!
    exit /b 1
)

REM Verificar SIMULATE
for /f "tokens=2 delims==" %%a in ('findstr /i "^SIMULATE=" .env') do (
    set SIMULATE=%%a
)

if not "%SIMULATE%"=="false" (
    echo.
    echo  ⚠️  ATENCAO: SIMULATE nao esta definido como 'false'
    echo  Bot esta em modo simulacao. Altere em .env para SIMULATE=false
    echo.
    exit /b 1
)

echo  ✓ .env validado (SIMULATE=false - MODO LIVE)
echo.

REM Criar diretório de logs
if not exist logs mkdir logs

REM Gerar timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set TIMESTAMP=%mydate%_%mytime%

set LOG_BOT=logs\bot_%TIMESTAMP%.log
set LOG_DASHBOARD=logs\dashboard_%TIMESTAMP%.log
set LOG_TESTE=logs\teste_%TIMESTAMP%.log

echo  📝 Logs serao salvos em:
echo    Bot: %LOG_BOT%
echo    Dashboard: %LOG_DASHBOARD%
echo    Teste: %LOG_TESTE%
echo.

REM Iniciar bot em background
echo  🤖 Iniciando Bot...
start "MB-Bot" cmd /k npm run live ^> "%LOG_BOT%" 2^>^&1
timeout /t 2 /nobreak > nul
echo  ✓ Bot iniciado
echo.

REM Aguardar bot inicializar (10 segundos)
timeout /t 10 /nobreak > nul

REM Iniciar dashboard em background
echo  📊 Iniciando Dashboard (porta 3001)...
start "MB-Dashboard" cmd /k npm run dashboard ^> "%LOG_DASHBOARD%" 2^>^&1
timeout /t 2 /nobreak > nul
echo  ✓ Dashboard iniciado
echo.

REM Aguardar dashboard inicializar
timeout /t 5 /nobreak > nul

REM Iniciar teste de validação
echo  ✅ Iniciando Teste de Validacao...
start "MB-Teste" cmd /k node test_live_complete.js
timeout /t 2 /nobreak > nul
echo  ✓ Teste iniciado
echo.

echo  ════════════════════════════════════════════════════════════
echo  ✓ TESTE LIVE COMPLETO INICIADO
echo  ════════════════════════════════════════════════════════════
echo.
echo  📊 Monitorar em: http://localhost:3001
echo  📝 Logs salvos em: logs\
echo.
echo  ⏱️  Teste executará até 20:30
echo.
echo  Verifique as janelas de terminal abertas:
echo    - MB-Bot:       Execução do bot
echo    - MB-Dashboard: Execução do dashboard
echo    - MB-Teste:     Validacoes em execucao
echo.
echo  Feche as janelas para encerrar quando o teste terminar.
echo.

pause

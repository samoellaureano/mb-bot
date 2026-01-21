@echo off
REM test_on_code_change.bat - Roda testes de 24h sempre que há alteração no código (Windows)
REM
REM Uso:
REM   test_on_code_change.bat         REM Monitora mudanças e roda testes
REM   node run_24h_test_cli.js        REM Roda teste uma única vez

cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║  🧪 TESTE AUTOMATIZADO DE 24 HORAS - MB BOT                   ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

REM Variáveis
set LAST_RUN=0
set MIN_INTERVAL=5
set "WATCH_FILES=momentum_order_validator.js bot.js cash_management_strategy.js swing_trading_strategy.js adaptive_strategy.js"

REM Armazenar timestamps iniciais
for %%F in (%WATCH_FILES%) do (
    if exist "%%F" (
        for %%A in (%%F) do set "file_time_%%F=%%~tA"
    )
)

echo.
echo 🔍 Monitorando alterações em arquivos críticos...
echo.
echo Arquivos sendo monitorados:
for %%F in (%WATCH_FILES%) do (
    echo   * %%F
)
echo.
echo ⚠️  Pressione Ctrl+C para parar.
echo.

REM Executar testes inicialmente
call :run_tests

REM Loop de monitoramento
:monitor_loop
timeout /t 2 /nobreak >nul

setlocal enabledelayedexpansion

for %%F in (%WATCH_FILES%) do (
    if exist "%%F" (
        for %%A in (%%F) do (
            if not "!file_time_%%F!"=="%%~tA" (
                echo.
                echo 📝 Alteração detectada em: %%F
                set "file_time_%%F=%%~tA"
                
                REM Aguardar um pouco
                timeout /t 1 /nobreak >nul
                
                REM Executar testes
                call :run_tests
                
                REM Volta ao loop
                goto monitor_loop
            )
        )
    )
)

goto monitor_loop

REM ═══════════════════════════════════════════════════════════════════════════
REM Função para executar testes
REM ═══════════════════════════════════════════════════════════════════════════
:run_tests
    echo.
    echo ════════════════════════════════════════════════════════
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
    for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
    echo 🔄 Executando testes às %mydate% %mytime%
    echo ════════════════════════════════════════════════════════
    echo.
    
    node run_24h_test_cli.js
    
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ✅ Testes passaram! Continuando monitoramento...
    ) else (
        echo.
        echo ❌ Testes falharam! Verifique o código.
    )
    
    echo.
    exit /b 0

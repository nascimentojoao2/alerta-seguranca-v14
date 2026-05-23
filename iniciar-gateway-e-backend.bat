@echo off
TITLE Alerta Seguranca Vortex7 - Gateway e Backend
echo.
echo ===============================================
echo   Alerta Seguranca Vortex7 - Inicializacao
echo ===============================================
echo.
where tailscale >nul 2>nul
if %errorlevel%==0 (
  echo [1/3] Cloudflare Tunnel encontrado. Verifique se ele esta conectado.
) else (
  echo [1/3] Cloudflare Tunnel nao encontrado pelo terminal. Abra o app Cloudflare Tunnel manualmente se necessario.
)

echo [2/3] Iniciando go2rtc em outra janela...
if exist go2rtc.exe (
  start "go2rtc - Cameras" cmd /k "go2rtc.exe -config go2rtc.yaml"
) else (
  echo ERRO: go2rtc.exe nao esta nesta pasta. Coloque o go2rtc.exe ao lado deste arquivo.
)

echo [3/3] Iniciando backend em outra janela...
start "Backend Alerta Seguranca" cmd /k "cd backend && npm install && npm start"

echo.
echo Depois teste:
echo   Painel Vortex7: https://api.vortex7.com.br/vortex
echo   Central GCM:    https://api.vortex7.com.br/gcm
echo   Camera:         https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230
echo.
pause

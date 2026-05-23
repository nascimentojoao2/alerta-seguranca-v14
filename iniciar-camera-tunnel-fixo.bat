@echo off
title Cloudflare Tunnel Fixo - Cameras Vortex7
cd /d %USERPROFILE%\Downloads
cloudflared.exe tunnel run alerta-seguranca-cameras
pause

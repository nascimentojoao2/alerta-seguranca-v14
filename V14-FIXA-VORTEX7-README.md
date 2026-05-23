# Alerta Segurança V14 — versão fixa Vortex7

Esta versão troca os links temporários `trycloudflare.com` por domínios fixos:

- API/backend: `https://api.vortex7.com.br`
- Painel Vortex7: `https://api.vortex7.com.br/vortex`
- Central GCM: `https://api.vortex7.com.br/gcm`
- Câmera Aurora: `https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230`

## Fluxo final

```txt
Câmera Intelbras 192.168.1.18
↓ RTSP
go2rtc no PC/gateway local
↓ Cloudflare Tunnel fixo
https://cam-aurora.vortex7.com.br
↓
App iPhone / Painéis web
```

```txt
Backend Node.js
↓ deploy cloud
https://api.vortex7.com.br
↓
App iPhone / Painel Vortex7 / Central GCM
```

## Rodar localmente ainda funciona

Câmera:

```bash
./go2rtc.exe -config go2rtc.yaml
```

Backend:

```bash
cd backend
npm install
npm start
```

Mobile:

```bash
npm install
npx expo start -c
```

## Variáveis do app

O app usa por padrão os domínios fixos. Para testar outro endereço, crie `.env` com:

```txt
EXPO_PUBLIC_API_BASE_URL=https://api.vortex7.com.br
EXPO_PUBLIC_CAMERA_STREAM_SERVER=https://cam-aurora.vortex7.com.br
```

## Contas demo

- Diretora: `diretora@aurora.edu.br` / `123456`
- GCM: `operador@gcm.sp.gov.br` / `123456`
- Vortex7 web: `painel@vortex7.com.br` / `vortex7`

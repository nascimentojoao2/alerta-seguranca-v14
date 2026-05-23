# Alerta Segurança V14 — Câmeras remotas por escola

Esta versão usa a câmera Intelbras VIP 3230 B SL via go2rtc e acesso remoto pelo Cloudflare Tunnel.

## Arquitetura atual do MVP

```txt
Intelbras VIP 3230 B SL
↓ RTSP local
go2rtc no PC/gateway
↓ Cloudflare Tunnel
App Alerta Segurança V14
```

## Endereços usados nesta versão

- IP da câmera: `192.168.1.18`
- URL pública do gateway de câmera: `https://cam-aurora.vortex7.com.br`
- Player usado no app: `https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230`

## Como rodar

1. Deixe a câmera ligada e acessível no IP `192.168.1.18`.
2. Deixe o Cloudflare Tunnel ligado no PC/gateway.
3. Rode o go2rtc na pasta do projeto:

```bash
./go2rtc.exe -config go2rtc.yaml
```

4. Teste no navegador:

```txt
https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230
```

5. Rode o app:

```bash
npm install
npx expo start -c
```

## Contas demo

- Diretora Aurora: `diretora@aurora.edu.br`
- GCM: `operador@gcm.sp.gov.br`

Senha: `123456` para as contas demo cadastradas.

## Controle por escola

O app já separa as câmeras por escola. A diretora/gestora entra vinculada à Escola Municipal Aurora e visualiza apenas as câmeras da própria escola. A GCM continua com visão geral das escolas monitoradas.

## Próxima etapa de produção

Trocar o endereço Cloudflare Tunnel por um gateway HTTPS protegido, por exemplo:

```txt
https://cameras.vortex7.com.br/escola-aurora/entrada
```

Para produção real, as permissões devem sair do código local e passar para backend + banco de dados com usuários, empresas/escolas e câmeras.

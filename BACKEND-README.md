# Alerta Segurança V9 — Backend + câmeras por escola

Esta versão adiciona um backend Node.js/Express simples para centralizar escolas, usuários e câmeras.

## O que mudou

- O app busca dados no backend em `https://api.vortex7.com.br`.
- A escola Aurora tem a câmera Intelbras real cadastrada.
- A diretora da Aurora acessa apenas a escola dela.
- A GCM acessa todas as escolas/câmeras.
- O backend usa `backend/db.json` como banco simples para MVP.

## 1. Rodar o go2rtc

Na pasta principal do projeto:

```bash
./go2rtc.exe -config go2rtc.yaml
```

Teste:

```txt
https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230
```

## 2. Rodar o backend

Abra outro terminal:

```bash
cd backend
npm install
npm start
```

Teste no navegador:

```txt
https://api.vortex7.com.br/api/health
```

Se estiver testando no próprio PC, também funciona:

```txt
http://localhost:3333/api/health
```

## 3. Rodar o app

Em outro terminal, na pasta principal:

```bash
npm install
npx expo start -c
```

## Contas demo

Gestora/Diretora:

```txt
diretora@aurora.edu.br
senha: qualquer uma
```

GCM:

```txt
operador@gcm.sp.gov.br
senha: qualquer uma
```

## Próxima evolução

Para produção, trocar `backend/db.json` por PostgreSQL/Supabase, adicionar senha real com hash, JWT real, permissões e Cloudflare Tunnel/domínio HTTPS.

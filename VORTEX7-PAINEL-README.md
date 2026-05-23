# Alerta Segurança V10 — Painel Vortex7

Esta versão adiciona o terceiro perfil do aplicativo: **Painel Vortex7**.

## Perfis disponíveis

### 1. Diretora / Escola
- A diretora entra com o login criado pela Vortex7.
- Ela vê somente a escola vinculada à conta dela.
- Ela vê somente as câmeras da escola dela.
- Ela consegue acionar alertas e acompanhar os próprios chamados.

Conta demo:
```txt
diretora@aurora.edu.br
senha: 123456
```

### 2. GCM
- A GCM acompanha ocorrências e câmeras operacionais.
- A GCM continua com visão de central.

Conta demo:
```txt
operador@gcm.sp.gov.br
senha: 123456
```

### 3. Painel Vortex7
- É o cérebro administrativo do sistema.
- Vê todas as escolas cadastradas.
- Vê todas as câmeras de todas as escolas.
- Cria novos logins de diretoras/gestores escolares.
- Cria novos logins da GCM.
- Edita logins existentes.
- Exclui logins.
- Visualiza as senhas cadastradas.

Conta master:
```txt
painel@vortex7.com.br
senha: vortex7
```

## Como rodar

### 1. go2rtc
Na pasta principal do projeto:
```bash
./go2rtc.exe -config go2rtc.yaml
```

### 2. Backend
```bash
cd backend
npm install
npm start
```

Teste o backend:
```txt
https://api.vortex7.com.br/api/health
```

### 3. App
Na pasta principal do app:
```bash
npm install
npx expo start -c
```

## Observação importante sobre senhas

Nesta V10, as senhas ficam visíveis no Painel Vortex7 porque esse foi o fluxo solicitado para MVP e demonstração. Para produção, o ideal é trocar isso por:

- senha com hash no backend;
- botão de redefinir senha;
- logs de auditoria;
- permissões reais por token JWT;
- painel web separado para administração.

## Fluxo de câmera

```txt
Câmera Intelbras
↓ RTSP
PC/Gateway com go2rtc
↓ Cloudflare Tunnel
App Alerta Segurança
```

Câmera real cadastrada:
```txt
Intelbras VIP 3230 B SL
IP local: 192.168.1.18
Gateway Cloudflare Tunnel: https://cam-aurora.vortex7.com.br
Player: https://cam-aurora.vortex7.com.br/stream.html?src=intelbras_vip_3230
```

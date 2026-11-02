# Envio de e-mails pelo Gmail

A aplicação usa SMTP do Gmail (smtp.gmail.com, porta 465, TLS) com Nodemailer. Não precisa de Resend nem domínio próprio. Cada familiar recebe uma mensagem separada, inclusive em endereços de outros provedores.

## Preparar sua conta Google

1. Entre na conta Gmail que enviará os convites.
2. Abra https://myaccount.google.com/security e ative a **Verificação em duas etapas**.
3. Acesse https://myaccount.google.com/apppasswords (o Google pode pedir login novamente).
4. Crie uma senha de app com o nome **Amigo Oculto Família**.
5. Copie os 16 caracteres gerados. Use essa senha de app na configuração, nunca a senha normal do Gmail. Espaços entre os grupos são removidos pelo assistente.

Se a opção não aparecer, verifique se a conta é corporativa/escolar com restrições, tem Proteção Avançada ou usa somente chaves de segurança na verificação em duas etapas. Nessas situações, a conta pode não permitir senhas de app. Esta integração exige que a conta permita esse recurso.

## Configurar o projeto

No PowerShell, dentro da pasta do projeto e com as dependências instaladas:

```powershell
npm run setup:email
npm run email:check
npm run email:test
npm run dev
```

O assistente pergunta seu Gmail, o nome do remetente, a URL e a senha de app (entrada oculta). Salva em .env.local, preservando os dados do organizador e removendo as variáveis antigas do Resend. Não informe a senha pelo chat nem a coloque no Git.

Variáveis equivalentes para configuração manual:

```dotenv
GMAIL_USER=seuemail@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME="Amigo Oculto da Família"
APP_URL=http://localhost:3000
```

A senha acima é apenas ilustrativa. Use a gerada pelo Google. O remetente sempre usa GMAIL_USER; EMAIL_FROM_NAME muda apenas o nome exibido.

email:check valida os campos sem conectar ao Gmail. email:test solicita um destinatário e envia UMA mensagem sem dados do sorteio, usando o mesmo transporte da aplicação. Pode testar em outro endereço; não existe a restrição de destinatário da conta de teste do Resend. Confira entrada, spam e Enviados no Gmail. Reinicie o servidor após alterar .env.local.

## Enviar convites e resultados

Entre em http://localhost:3000/admin/login. Envie os convites pelo painel; se o sorteio já estiver salvo, use **Enviar pendentes e tentar falhas**, sem refazê-lo. Os pares continuam iguais. O painel registra tentativas, mensagens aceitas e falhas.

APP_URL precisa apontar para uma URL que os familiares consigam acessar. localhost só funciona no próprio computador; o envio de e-mail pode funcionar mesmo que o link ainda não esteja acessível para eles. Para hospedar, configure também o PostgreSQL externo conforme README.

## Limites e diagnóstico

- O Gmail aplica limites de envio e pode bloquear temporariamente envios suspeitos. Esta integração não oferece envios ilimitados.
- Senha recusada: confirme o Gmail completo, a verificação em duas etapas e a senha de app. Se mudar a senha principal da conta Google, gere uma nova senha de app.
- Uma mensagem aceita pelo SMTP não confirma chegada à caixa de entrada ou leitura.
- SMTP não oferece a chave de idempotência do Resend. Uma interrupção após a aceitação pode causar duplicata ao reenviar; confira Enviados antes de repetir um envio incerto. O Message-ID estável ajuda a rastrear, mas não garante deduplicação.
- O teste real só pode ser confirmado após configurar a credencial na sua máquina.

Fontes oficiais: [Senhas de app Google](https://support.google.com/accounts/answer/185833?hl=pt-BR), [SMTP Gmail](https://support.google.com/mail/answer/7126229?hl=pt-BR), [Nodemailer SMTP](https://nodemailer.com/smtp).

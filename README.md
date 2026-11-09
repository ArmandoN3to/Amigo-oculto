# Amigo Oculto da Família

Aplicação simples em português para organizar o amigo oculto de cada ano. Um único projeto Next.js reúne interface com shadcn/ui, administração protegida, sorteio com exclusões opcionais, listas de presentes e integração de e-mail pelo Gmail.

## Rodar no computador

Requer Node.js 22 e npm.

```powershell
cd C:\Users\arneto\Documents\repos\amigo-oculto-familia
npm install
npm run setup
npm run dev
```

O assistente `setup` solicita o e-mail e a senha do organizador e gera os segredos locais. Não há senha padrão. Abra http://localhost:3000 para a página pública e digite http://localhost:3000/admin/login para administrar. A navegação pública não mostra a administração.

O desenvolvimento usa PostgreSQL embutido com PGlite, persistido em `.data/`. Não precisa de conta em banco externo. Faça cópias de segurança dessa pasta e de `.env.local` com o servidor parado. Não publique nem compartilhe esses arquivos.

Execute somente uma instância local por pasta de dados. Pare o servidor antes de executar `npm run db:migrate`, redefinir o organizador com `npm run setup -- --reset-admin` ou fazer backup. Essa limitação não se aplica ao PostgreSQL externo.

## Organizar o evento

1. Entre no painel e crie o evento com nome, data e valor sugerido opcional.
2. Cadastre os familiares com nome e e-mail. A quantidade é determinada pelo cadastro; o sorteio exige pelo menos duas pessoas.
3. Se necessário, configure exclusões. A regra “Ana não pode tirar Bruno” é direcional; para impedir os dois sentidos, cadastre também a regra inversa.
4. Envie convites para os participantes preencherem suas sugestões de presentes.
5. Confirme o sorteio. Os pares são salvos antes de enviar os resultados. Cada e-mail de resultado inclui o nome sorteado e o link individual.
6. Acompanhe os envios e tente novamente os pendentes ou com falha. Reenviar não muda os pares.

No cadastro do familiar, escolha ou cole um emoji. O botão **Emoji** permite alterá-lo também após o sorteio. Ao descobrir o amigo oculto, a animação usa o emoji da pessoa sorteada (🎁 quando vazio). O resultado aparece sem animação quando o dispositivo prefere movimento reduzido.

Cada participante acessa somente seu link, edita suas sugestões e consulta o nome e as sugestões da pessoa sorteada. O painel administrativo não lista os pares.

As sugestões são adicionadas uma por vez, em um campo de até 120 caracteres com o botão **Adicionar** ao lado. Adicionar e remover salva a lista automaticamente; o limite total é de 5.000 caracteres. Sugestões antigas mais longas continuam disponíveis até serem removidas.

O botão de foto ao lado do campo ou de uma sugestão salva permite incluir uma imagem opcional. São aceitos JPG, PNG e WebP de até 3 MB, com uma foto por sugestão e até 10 por participante. **Ver foto** abre a imagem em outra aba. Apenas quem enviou a foto e quem tirou essa pessoa no sorteio atual podem abrir a imagem com seus links individuais.

Após o sorteio, o cadastro e as exclusões ficam bloqueados. Refazer o sorteio exige confirmação explícita e substitui os resultados anteriores. Uma combinação impossível de exclusões gera erro e preserva o sorteio salvo.

Para o ano seguinte, crie outro evento e copie os familiares do evento anterior. A cópia leva nomes, e-mails e emojis. Resultados, links, sugestões, exclusões e envios pertencem a cada evento.

## Configurar os e-mails

O envio usa Gmail SMTP com senha de app do Google. Ative a verificação em duas etapas, crie uma senha em https://myaccount.google.com/apppasswords e execute:

```powershell
npm run setup:email
npm run email:check
npm run email:test
```

O assistente salva GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_FROM_NAME e APP_URL no .env.local, preservando o organizador. Reinicie npm run dev depois. Use uma URL acessível pelos familiares: localhost só abre no computador que acessa o link. Consulte [docs/EMAIL.md](docs/EMAIL.md) para o passo a passo e diagnóstico.

Os resultados são salvos antes do envio. Falhas podem ser retomadas pelo painel sem refazer o sorteio. Gmail possui limites de envio; mensagens aceitas não confirmam entrega. Em falhas de conexão incertas, confira Enviados antes de repetir, pois SMTP pode produzir duplicatas.

## Banco externo e Vercel depois

Não foi feito deploy nem criada infraestrutura externa nesta etapa. Para hospedar posteriormente, configure `DATABASE_URL` de um PostgreSQL gerenciado, as credenciais administrativas, `AUTH_SECRET`, `APP_URL` e o provedor de e-mail. Execute `npm run db:migrate` antes de disponibilizar o aplicativo.

O PGlite em arquivos locais serve ao desenvolvimento. Ele não é usado como persistência em hospedagem serverless. Os dados locais não são transferidos automaticamente ao informar um banco externo.

Não coloque segredos em variáveis `NEXT_PUBLIC_*`. `.env.local` e `.data/` são ignorados pelo Git. Guarde o segredo que assina os links: sua troca exige gerar novos acessos.

## Verificar

```powershell
npm test
npm run typecheck
npm run build
```

Os testes usam dados fictícios e não enviam e-mails a familiares. Um envio real depende de configurar e testar o provedor.

Validação desta entrega: 16 testes passaram; TypeScript e build de produção passaram. O fluxo de login, cadastro, exclusões, impossibilidade de sorteio, sorteio válido, cópia anual, sugestões antes/depois e saída da sessão foi conferido no navegador em banco fictício separado. A interface foi revisada em tamanhos de celular e desktop. PostgreSQL externo e envio real não foram exercitados por dependerem de credenciais.

O sorteio usa aleatoriedade criptográfica e uma busca completa por uma combinação permitida. O algoritmo termina com erro quando não há solução; não promete probabilidade uniforme entre todas as combinações possíveis com restrições.

## Estrutura

- `src/app/`: páginas públicas, administração e página individual.
- `src/components/`: interface e componentes shadcn/ui.
- `src/lib/`: banco, autenticação, validações, tokens, sorteio e e-mail.
- `src/server/`: consultas autorizadas e ações de servidor.
- `migrations/`: esquema SQL PostgreSQL.
- `scripts/`: configuração local e migrações.
- `tests/`: verificação das regras e da persistência.
- `docs/PLANO.md`: decisões e critérios de aceite.

O organizador deve excluir os dados e cópias de segurança quando não forem mais necessários. O histórico anual fica guardado até essa exclusão.

## Diagnóstico de envio

O painel mostra as variáveis ausentes ou inválidas, avisa quando APP_URL aponta para localhost e exibe tentativas e último erro por participante. Consulte `docs/EMAIL.md` para configurar o teste no próprio endereço ou o envio à família.

Revisão do fluxo principal: 23 testes passaram, checagem de tipos e build passaram. O cenário por Server Actions cobre login, cadastro, convites, listas, sorteio, falha e reenvio com os mesmos pares, renovação do token, cópia anual e logout. Os envios desses testes usam transporte simulado; entrega real ainda depende de configurar a conta Gmail.

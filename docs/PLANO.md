# Plano do Amigo Oculto da Família

Este projeto será uma aplicação simples para organizar o amigo oculto anual da família. O desenvolvimento atual entrega o projeto local; não inclui configurar a conta Vercel, criar serviços externos ou fazer deploy. As respostas do usuário prevalecem sobre as sugestões do documento de referência.

## Decisões confirmadas

- Uma aplicação Next.js com TypeScript, App Router, frontend React e backend no mesmo projeto.
- Componentes shadcn/ui e Tailwind CSS, com visual natalino minimalista, textos em português e funcionamento em celular e desktop.
- Um organizador administra os eventos por uma área protegida, acessada diretamente por URL e sem links na navegação pública.
- Participantes não criam contas. Recebem acesso individual por link seguro e editam uma lista de presentes em texto livre.
- Os e-mails são automáticos e incluem o nome do sorteado no corpo, além do link individual para consultar suas sugestões e editar a própria lista.
- Não há restrições adicionais por padrão. O organizador pode configurar exclusões antes do sorteio.
- A quantidade de participantes será definida durante o cadastro, respeitando o mínimo de duas pessoas para sortear.
- O aplicativo será reutilizado a cada ano. Cada evento terá participantes, restrições e resultados independentes, preservando o histórico.
- O usuário já possui conta Vercel, mas pediu expressamente que ela não seja configurada e que não seja feito deploy nesta etapa.

## Escopo funcional

### Página inicial

Apresentar o evento e orientar o familiar a abrir o link recebido por e-mail. Não listar participantes, resultados, endereços de e-mail ou links administrativos. Se não houver evento cadastrado, apresentar um estado vazio claro. Havendo vários eventos, usar o mais recente como referência pública, sem misturar dados entre anos.

### Administração

Disponibilizar login em `/admin/login` e proteger `/admin` e todas as operações administrativas no servidor. O organizador poderá criar eventos com nome, data e valor sugerido opcional; cadastrar, editar e remover participantes antes do sorteio; configurar exclusões; enviar convites; confirmar o sorteio; consultar o estado dos envios; e reenviar mensagens com falha.

Cada evento deve poder ser consultado separadamente. Para reduzir o trabalho no ano seguinte, permitir copiar os participantes de um evento para um novo evento. Essa cópia inclui apenas os dados cadastrais necessários, sem reaproveitar pares, tokens, estados de envio, listas de presentes ou exclusões do evento anterior.

Depois do sorteio, bloquear alterações nos participantes e nas exclusões que possam invalidar a distribuição. Refazer o sorteio exige ação explícita e confirmação de que o resultado anterior será substituído. A consulta administrativa comum não deve revelar todos os pares.

### Exclusões

Uma exclusão é direcional: a regra “Ana não pode tirar Bruno” não impede Bruno de tirar Ana. A interface deve explicar essa direção. Para uma restrição mútua, o organizador cadastra as duas direções.

Aceitar apenas participantes do mesmo evento, impedir exclusões duplicadas e remover referências ao excluir um participante. A regra de ninguém tirar a si mesmo é permanente e não precisa de cadastro.

Quando as exclusões tornarem o sorteio impossível, apresentar uma mensagem acionável e não criar, substituir ou remover resultados. A busca por uma distribuição válida deve terminar de forma controlada; não depender de tentativas aleatórias ilimitadas.

### Sorteio

Cada participante deve tirar exatamente uma outra pessoa, cada destinatário deve aparecer uma única vez e todas as exclusões devem ser respeitadas. A escolha usa aleatoriedade criptográfica.

Validar a distribuição completa antes de persistir. Salvar todos os pares e o estado do evento em uma transação. Impedir sorteios concorrentes ou duplo clique de produzir distribuições parciais ou substituir silenciosamente um resultado existente.

O envio de e-mail acontece após a confirmação no banco. Uma falha de envio não desfaz o sorteio. Reenviar mensagens preserva exatamente os pares já gravados. Uma tentativa malsucedida de refazer o sorteio preserva o resultado anterior.

### Página do participante

Em `/participante/[token]`, validar o token no servidor. Antes do sorteio, exibir a própria lista de presentes para edição e informar que o sorteio ainda não aconteceu. Depois do sorteio, permitir editar a própria lista e consultar apenas o nome e a lista de presentes do destinatário.

Não revelar quem tirou o participante, os outros pares ou dados de contato de terceiros. Links inválidos ou revogados não devem revelar dados pessoais. As páginas individuais não devem ser indexadas nem armazenadas em cache público.

### E-mails

Integrar Gmail SMTP com senha de app para convites e resultados. O resultado inclui o nome do sorteado e o link individual, conforme a resposta do usuário. O convite permite preencher a lista antes do sorteio.

Registrar tipo, estado, tentativas, erro operacional e data de envio. Sem configuração do provedor, manter as mensagens pendentes e informar a configuração ausente na administração. Não simular sucesso nem afirmar que houve envio real.

Para o tamanho esperado de um grupo familiar, usar processamento simples, limitado e aguardado, sem depender de trabalho em segundo plano depois da resposta do servidor. Prevenir envios concorrentes duplicados e manter uma ação de retentativa. Um webhook de e-mail não é necessário para este escopo.

## Implementação técnica

- Banco PostgreSQL local com `@electric-sql/pglite` para iniciar sem conta em serviço externo.
- Driver `pg` quando `DATABASE_URL` estiver presente, permitindo usar PostgreSQL externo posteriormente.
- Migrações SQL portáveis. Prisma era uma sugestão opcional do documento e não será utilizado nesta implementação.
- Dados locais persistidos em diretório ignorado pelo Git. O banco local não é uma solução de persistência para produção serverless.
- Validação de entrada no servidor, consultas parametrizadas, restrições no banco e transações nas operações críticas.
- Uma credencial administrativa protegida, senha com hash seguro, sessão em cookie HttpOnly e SameSite, expiração de sessão e limitação de tentativas de login.
- Tokens longos, imprevisíveis e verificados por hash; nenhum token em texto puro no banco ou em logs. A estratégia de reenvio deve preservar a segurança dos links e ser documentada.
- Nenhum segredo no repositório ou no código do navegador. Entregar `.env.example` e instruções de configuração local.
- Respostas administrativas e individuais privadas, sem cache público e sem exposição desnecessária de dados.

## Organização do trabalho

O agente de planejamento consolida requisitos e critérios de aceite. O agente de backend implementa banco, autenticação, validações, sorteio, ações de servidor e e-mails. O agente de frontend implementa as telas e os componentes shadcn/ui, respeitando os contratos combinados com o backend. O agente principal integra, executa as verificações e prepara a entrega.

O desenvolvimento ocorre inicialmente em `C:\Users\arneto\Documents\Codex\2026-11-02\fa\work\amigo-oculto-familia`. O destino solicitado pelo usuário é `C:\Users\arneto\Documents\repos\amigo-oculto-familia`; a entrega final deve preservar arquivos existentes nesse destino, se houver.

## Critérios de aceite

1. O projeto instala, inicia localmente e gera build de produção com as instruções fornecidas.
2. O organizador autentica e executa as operações administrativas; requisições sem autorização são recusadas no servidor.
3. Não existe link para a administração na navegação pública.
4. O cadastro recusa e-mails duplicados no mesmo evento e aceita o mesmo familiar em eventos anuais diferentes.
5. O evento permite cadastrar exclusões direcionais e explica sua direção na interface.
6. Sorteios com 2, 3, 10 e 30 participantes produzem distribuições completas, sem autoatribuição ou destinatários repetidos.
7. Exclusões possíveis são respeitadas; exclusões impossíveis geram erro sem alteração dos resultados existentes.
8. Repetição da confirmação e concorrência não criam dois sorteios nem pares parciais para um evento.
9. Cada participante altera apenas sua lista e consulta apenas seu destinatário e as sugestões dele.
10. A lista pode ser alterada antes e depois do sorteio, sem alterar os pares.
11. Falhas de e-mail preservam o sorteio e podem ser reenviadas com os mesmos pares. Sem credenciais, o sistema informa a pendência sem simular envio.
12. As mensagens de resultado incluem o nome sorteado e o link individual. Um envio real só pode ser confirmado após configurar e testar um provedor real.
13. Eventos anuais mantêm históricos separados. A cópia de participantes para outro ano não copia resultados, tokens, estados de envio, listas ou exclusões.
14. Estados vazios, erros, confirmações e telas principais são legíveis e utilizáveis em celular, desktop e navegação por teclado.
15. Não há deploy, criação de serviços externos ou configuração da conta Vercel nesta entrega.

## Verificação prevista

Executar testes das regras de sorteio e de exclusões, incluindo casos impossíveis e repetidas execuções. Verificar autorização, isolamento por evento e por participante, persistência e preservação dos resultados ao falhar o envio. Executar checagem de tipos e build. Revisar os fluxos principais no navegador quando o ambiente permitir.

Os testes locais devem usar dados fictícios e transporte de e-mail controlado, sem enviar mensagens a familiares. Registrar na entrega qualquer verificação que dependa de credenciais externas ainda não configuradas.

## Fora do escopo

Não incluir fotos, integração com lojas, chat, pagamentos, aplicativo nativo, múltiplos administradores, integrações automáticas com WhatsApp, bloqueio automático de casais ou repetição de anos anteriores. Não incluir uma plataforma genérica para famílias independentes. Regras extras serão somente as exclusões configuradas pelo organizador.

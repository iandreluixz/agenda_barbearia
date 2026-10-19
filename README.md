# Ateliê Barbearia

Sistema web de agendamento para barbearias. O cliente consulta serviços e profissionais, escolhe uma data e um horário disponível e envia a reserva pela página. A aplicação valida os dados no servidor e usa uma restrição do PostgreSQL para impedir reservas sobrepostas para o mesmo profissional.

O projeto também pode enviar confirmações e lembretes por e-mail usando SMTP. A interface e os dados iniciais foram preparados para demonstração e precisam ser ajustados antes de atender clientes reais.

## Funcionalidades

- Página responsiva em português, servida pelo próprio Express.
- Consulta de serviços e profissionais ativos no banco de dados.
- Calendário em português e consulta de horários ocupados por profissional.
- Validação dos dados no navegador e na API.
- Regras de funcionamento: segunda a sábado, entre 9h e 19h, no fuso configurado.
- Proteção no PostgreSQL contra dois agendamentos confirmados sobrepostos.
- Envio opcional de confirmação e lembrete por e-mail.
- Imagens ilustrativas e galeria de referências de cortes.

## Tecnologias

| Componente | Tecnologia |
| --- | --- |
| Servidor e API | Node.js, TypeScript e Express |
| Banco de dados | PostgreSQL |
| Validação | Zod |
| E-mail | Nodemailer e SMTP |
| Interface | HTML, CSS e JavaScript |
| Testes | Node.js Test Runner e `tsx` |

## Arquitetura e fluxo de agendamento

O Express serve os arquivos estáticos de `public/` e disponibiliza a API em `/api`. A interface carrega os serviços e profissionais do banco, consulta os horários já reservados e apresenta os horários livres em intervalos de 30 minutos.

Quando o cliente confirma a reserva, o servidor valida nome, e-mail, identificadores e data. A duração é obtida do serviço no banco; o servidor calcula o horário final e verifica se o atendimento está no futuro e cabe no horário de funcionamento. Se os dados forem válidos, a reserva é gravada no PostgreSQL.

A consulta feita pela interface serve para mostrar a disponibilidade, mas não é a garantia final contra concorrência: outra pessoa pode reservar o mesmo horário antes do envio do formulário. A regra definitiva é aplicada pelo banco no momento da gravação.

### Concorrência e intervalos

A tabela `appointments` possui a restrição `appointments_no_overlap`, que impede intervalos confirmados sobrepostos para o mesmo profissional. Ela usa `tstzrange` com limites `[início, fim)` e uma constraint de exclusão GiST, habilitada pela extensão `btree_gist`.

Com esse formato, um atendimento pode começar no instante em que o anterior termina. Se duas requisições concorrentes tentarem ocupar horários incompatíveis, o banco aceita uma e rejeita a outra; a API converte esse conflito em HTTP `409`.

## Requisitos

- Node.js 20 ou superior.
- PostgreSQL com suporte à extensão `btree_gist`.
- Um banco PostgreSQL já criado e um usuário com permissão para criar a extensão e as tabelas.
- Conta e remetente verificado em um provedor SMTP, se o envio de e-mails for necessário.

## Instalação e execução

Os comandos abaixo usam PowerShell no Windows. Execute-os no diretório do projeto.

### 1. Instalar dependências

```powershell
npm install
```

### 2. Criar o banco

Crie um banco chamado `agenda_barbearia` no PostgreSQL. É possível fazer isso pelo pgAdmin ou por outro cliente PostgreSQL.

### 3. Configurar o ambiente

Copie o arquivo de exemplo para `.env`:

```powershell
Copy-Item .env.example .env
```

Edite `.env` com a URL de conexão do seu banco:

```env
PORT=3000
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/agenda_barbearia
BUSINESS_TIME_ZONE=America/Sao_Paulo
```

Substitua `USUARIO` e `SENHA` pelas credenciais do PostgreSQL. Se a senha contiver caracteres reservados em uma URL, codifique-os antes de usá-la em `DATABASE_URL`.

`DATABASE_URL` é obrigatória. `PORT` é opcional e assume `3000`; `BUSINESS_TIME_ZONE` é opcional e assume `America/Sao_Paulo`. O arquivo `.env` contém credenciais e não deve ser enviado ao GitHub. Ele já está listado no `.gitignore`.

### 4. Criar tabelas e dados iniciais

```powershell
npm run db:setup
```

O script executa `database/schema.sql`, cria a estrutura e insere os serviços e profissionais de demonstração quando ainda não existem. O banco informado em `DATABASE_URL` precisa existir antes da execução.

### 5. Iniciar o servidor

Para desenvolvimento, com reinicialização automática ao alterar arquivos TypeScript:

```powershell
npm run dev
```

Acesse `http://localhost:3000`. O endpoint `http://localhost:3000/api/health` verifica a conexão com o banco e responde `{"status":"ok"}` quando a aplicação está pronta.

Para compilar e iniciar a versão compilada:

```powershell
npm run build
npm start
```

## Configuração de e-mail

O envio é opcional. Para usar o Resend via SMTP, configure no `.env` os dados da conta e um remetente autorizado pelo domínio verificado:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=SUA_CHAVE_DO_RESEND
SMTP_FROM="Ateliê Barbearia <agenda@seudominio.com>"
```

Substitua a chave e o endereço de remetente pelos valores da sua conta. Não coloque credenciais no código, neste arquivo ou em commits. Depois de alterar `.env`, reinicie o servidor.

Quando `SMTP_HOST` e `SMTP_FROM` estão configurados, a aplicação tenta enviar uma confirmação após a reserva e verifica lembretes periodicamente. Os lembretes são destinados a reservas confirmadas que começam nas próximas 24 horas. Se o e-mail de confirmação falhar, a reserva permanece criada; a resposta informa o resultado em `confirmationSent`. Sem configuração SMTP, o agendamento continua funcionando, mas não há envio de e-mails.

## API

Todas as rotas retornam JSON.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Confirma que o servidor consegue consultar o PostgreSQL. |
| `GET` | `/api/services` | Lista serviços ativos, incluindo duração e preço em centavos. |
| `GET` | `/api/professionals` | Lista profissionais ativos. |
| `GET` | `/api/appointments?from=<ISO>&to=<ISO>&professionalId=<id>` | Lista intervalos confirmados que se sobrepõem ao período consultado. |
| `POST` | `/api/appointments` | Valida e cria um agendamento. |

Exemplo do corpo enviado para `POST /api/appointments`:

```json
{
  "customerName": "Ana Souza",
  "customerEmail": "ana@example.com",
  "professionalId": 1,
  "serviceId": 1,
  "startsAt": "2026-10-20T13:00:00.000Z"
}
```

`startsAt` deve ser uma data ISO 8601 com fuso horário. A duração não é recebida do cliente: ela vem do serviço selecionado no banco.

Respostas relevantes de `POST /api/appointments`:

- `201 Created`: agendamento criado; inclui os horários de início e fim e `confirmationSent`.
- `400 Bad Request`: dados inválidos, horário passado ou regra de funcionamento violada.
- `404 Not Found`: serviço ou profissional inexistente ou inativo.
- `409 Conflict`: outro agendamento confirmado ocupa parte do intervalo para o mesmo profissional.

Erros de validação incluem uma mensagem e detalhes por campo. Os demais erros são registrados no servidor e retornam uma mensagem genérica.

## Banco de dados

O esquema em `database/schema.sql` define três tabelas:

- `professionals`: nome e estado de atividade do profissional;
- `services`: nome, duração em minutos, preço em centavos e estado de atividade;
- `appointments`: cliente, referências ao serviço e profissional, intervalo, estado da reserva e controle dos lembretes.

Os horários são armazenados como `TIMESTAMPTZ`. A duração e o preço dos serviços de demonstração estão no script SQL; o preço é armazenado em centavos. Uma reserva tem estado `confirmed` ou `cancelled`, embora o fluxo atual da interface não ofereça cancelamento.

Em uma instalação vazia, o esquema inclui estes dados de exemplo:

| Serviço | Duração | Preço |
| --- | ---: | ---: |
| Corte | 30 minutos | R$ 40,00 |
| Barba | 30 minutos | R$ 30,00 |
| Corte + barba | 60 minutos | R$ 65,00 |

Os profissionais iniciais são Rafael e Marcos. Atualize esses dados diretamente no banco antes de usar a agenda em um estabelecimento.

## Testes

Execute os testes unitários das regras de horário e sobreposição:

```powershell
npm test
```

Compile o código TypeScript com verificação de tipos:

```powershell
npm run build
```

Os testes atuais verificam as regras de horário e intervalos. Eles não substituem testes de integração com um PostgreSQL real.

## Estrutura do projeto

```text
database/
  schema.sql                Tabelas, restrições e dados iniciais
public/
  images/                   Logo, imagem de abertura, ilustrações e referências
  index.html                Estrutura da página
  styles.css                Estilos, responsividade e animações
  app.js                    Calendário, disponibilidade e envio do formulário
src/
  booking-rules.ts          Regras de horário e sobreposição
  database.ts               Pool de conexões PostgreSQL
  email.ts                  Confirmações e lembretes SMTP
  server.ts                 API e inicialização do servidor
  setup-database.ts         Execução do esquema inicial
tests/
  booking-rules.test.ts     Testes unitários das regras de agendamento
.env.example                Modelo das variáveis de ambiente
```

## Imagens e dados de demonstração

Os cartões de profissionais usam ilustrações fictícias. A galeria contém referências de cortes do Wikimedia Commons em licença CC0; a página apresenta os links de origem e licença, e os rostos foram desfocados. A imagem de abertura foi fornecida como referência para o projeto.

Os serviços e profissionais inseridos pelo esquema são exemplos. O telefone `(35) 99999-9999` e os links do WhatsApp também são fictícios. Substitua os contatos por números autorizados e confirme as permissões de uso de quaisquer imagens ou dados reais antes de publicar.

## Escopo e preparação para produção

A aplicação implementa o fluxo público de consulta e criação de agendamentos. Ainda não possui painel administrativo, cadastro de serviços pela interface, horários de trabalho configuráveis por profissional, cancelamento ou remarcação pelo cliente ou pagamentos online. Alterações de serviços e profissionais são feitas diretamente no banco.

Executar localmente não publica o site na internet. Para atender clientes, será necessário preparar hospedagem para a aplicação e o PostgreSQL, domínio e HTTPS, backups, monitoramento e credenciais seguras. Avalie também autenticação para funções administrativas, política de privacidade, tratamento dos dados pessoais e obrigações aplicáveis da LGPD.

# Ateliê Barbearia

Sistema web de agendamento para barbearias. O cliente consulta serviços e profissionais, escolhe uma data e um horário disponível e envia a reserva pela página. O servidor valida os dados, e o PostgreSQL impede reservas sobrepostas para o mesmo profissional.

O projeto também pode enviar confirmações e lembretes por e-mail usando SMTP. A interface e os dados iniciais são de demonstração e precisam ser ajustados antes de atender clientes reais.

## Funcionalidades

- Página responsiva em português, servida pelo próprio Express.
- Consulta de serviços e profissionais ativos no banco de dados.
- Calendário em português com horários livres em intervalos de 30 minutos.
- Validação dos dados no navegador e na API.
- Regras de funcionamento: segunda a sábado, das 9h às 19h, no fuso configurado.
- Proteção contra agendamentos sobrepostos no próprio banco de dados.
- Envio opcional de confirmação e lembrete por e-mail.
- Galeria de referências de cortes.

## Tecnologias

| Componente | Tecnologia |
| --- | --- |
| Servidor e API | Node.js, TypeScript e Express |
| Banco de dados | PostgreSQL |
| Validação | Zod |
| E-mail | Nodemailer e SMTP |
| Interface | HTML, CSS e JavaScript |
| Testes | Node.js Test Runner e `tsx` |

## Como funciona o agendamento

O Express serve os arquivos de `public/` e disponibiliza a API em `/api`. A interface consulta os horários já reservados para mostrar a disponibilidade. Ao confirmar, o servidor valida nome, e-mail, identificadores e data. A duração vem do serviço no banco, e o servidor calcula o horário final, verifica se o atendimento está no futuro e confirma que ele cabe no horário de funcionamento.

A consulta da interface serve apenas para exibir a disponibilidade. A garantia contra conflitos é a restrição `appointments_no_overlap`, criada no PostgreSQL com `tstzrange` no formato `[início, fim)` e uma constraint de exclusão GiST, que depende da extensão `btree_gist`. Por isso, um atendimento pode começar no instante em que o anterior termina. Se duas requisições disputarem o mesmo horário, o banco aceita apenas uma, e a API responde com `409` para a outra.

## Requisitos

- Node.js 20 ou superior.
- PostgreSQL com suporte à extensão `btree_gist`.
- Um banco PostgreSQL já criado e um usuário com permissão para criar extensões e tabelas.
- Conta e remetente verificado em um provedor SMTP, se o envio de e-mails for necessário.

## Instalação e execução

Execute os comandos na raiz do projeto. Use o bloco correspondente ao seu sistema operacional.

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o banco

Crie um banco chamado `agenda_barbearia` no PostgreSQL, pelo pgAdmin ou por outro cliente.

### 3. Configurar o ambiente

Copie o arquivo de exemplo para `.env`.

No Linux e no macOS:

```bash
cp .env.example .env
```

No Windows (PowerShell):

```powershell
Copy-Item .env.example .env
```

Edite o `.env` com a URL de conexão do seu banco:

```env
PORT=3000
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/agenda_barbearia
BUSINESS_TIME_ZONE=America/Sao_Paulo
```

Substitua `USUARIO` e `SENHA` pelas credenciais do PostgreSQL. Se a senha contiver caracteres reservados em uma URL, codifique-os antes de usá-la. Por exemplo, `@` vira `%40`, `#` vira `%23`, `/` vira `%2F` e `%` vira `%25`.

- `DATABASE_URL` é obrigatória.
- `PORT` é opcional e assume `3000`.
- `BUSINESS_TIME_ZONE` é opcional e assume `America/Sao_Paulo`.

O arquivo `.env` contém credenciais e não deve ser enviado ao GitHub. Ele já está listado no `.gitignore`.

### 4. Criar tabelas e dados iniciais

```bash
npm run db:setup
```

O script executa `database/schema.sql`, cria a estrutura e insere os serviços e profissionais de demonstração, se ainda não existirem. O banco informado em `DATABASE_URL` precisa existir antes dessa etapa.

### 5. Iniciar o servidor

Para desenvolvimento, com reinicialização automática ao alterar arquivos TypeScript:

```bash
npm run dev
```

Acesse `http://localhost:3000`. O endpoint `http://localhost:3000/api/health` verifica a conexão com o banco e responde `{"status":"ok"}` quando a aplicação está pronta.

Para compilar e executar a versão compilada:

```bash
npm run build
npm start
```

## Configuração de e-mail

O envio de e-mails é opcional. Para usar o Resend via SMTP, configure no `.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=SUA_CHAVE_DO_RESEND
SMTP_FROM="Ateliê Barbearia <agenda@seudominio.com>"
```

Use a chave e o remetente da sua conta, com um endereço autorizado pelo domínio verificado. Não coloque credenciais no código, neste README ou em commits. Depois de alterar o `.env`, reinicie o servidor.

Quando `SMTP_HOST` e `SMTP_FROM` estão configurados, a aplicação tenta enviar uma confirmação após cada reserva e verifica lembretes periodicamente. Os lembretes são enviados para reservas confirmadas que começam nas próximas 24 horas. Se o e-mail de confirmação falhar, a reserva continua criada, e a resposta informa o resultado em `confirmationSent`. Sem configuração SMTP, o agendamento funciona normalmente, mas nenhum e-mail é enviado.

## API

Todas as rotas retornam JSON.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Confirma que o servidor consegue consultar o PostgreSQL. |
| `GET` | `/api/services` | Lista serviços ativos, com duração e preço em centavos. |
| `GET` | `/api/professionals` | Lista profissionais ativos. |
| `GET` | `/api/appointments?from=<ISO>&to=<ISO>&professionalId=<id>` | Lista intervalos confirmados que se sobrepõem ao período consultado. |
| `POST` | `/api/appointments` | Valida e cria um agendamento. |

Exemplo de corpo para `POST /api/appointments`:

```json
{
  "customerName": "Ana Souza",
  "customerEmail": "ana@example.com",
  "professionalId": 1,
  "serviceId": 1,
  "startsAt": "2026-10-20T13:00:00.000Z"
}
```

`startsAt` deve ser uma data ISO 8601 com fuso horário. A duração não é enviada pelo cliente; ela vem do serviço selecionado no banco.

Respostas relevantes de `POST /api/appointments`:

- `201 Created`: agendamento criado, com horários de início e fim e `confirmationSent`.
- `400 Bad Request`: dados inválidos, horário no passado ou fora do horário de funcionamento.
- `404 Not Found`: serviço ou profissional inexistente ou inativo.
- `409 Conflict`: outro agendamento confirmado ocupa parte do intervalo para o mesmo profissional.

Erros de validação incluem uma mensagem e detalhes por campo. Os demais erros são registrados no servidor e retornam uma mensagem genérica.

## Banco de dados

O arquivo `database/schema.sql` define três tabelas:

- `professionals`: nome e situação de atividade.
- `services`: nome, duração em minutos, preço em centavos e situação de atividade.
- `appointments`: cliente, serviço, profissional,

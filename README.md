<div align="center">

# Ateliê Barbearia

**Um bom corte começa com um bom horário.**

Uma agenda online para encontrar um serviço, escolher o barbeiro e reservar um horário — com confirmação por e-mail e proteção contra reservas duplicadas.

Feito com **Node.js**, **TypeScript**, **Express** e **PostgreSQL**.

</div>

---

## Sobre o projeto

O Ateliê Barbearia é uma aplicação web de agendamento para uma barbearia. O cliente informa seus dados, escolhe um serviço, um profissional, a data e um horário disponível. A aplicação valida a reserva e o banco de dados garante que dois clientes não consigam ocupar o mesmo horário com o mesmo profissional.

O projeto também pode enviar uma confirmação de agendamento e um lembrete por e-mail usando SMTP — configurado aqui para funcionar com o Resend.

## O que já funciona

- Página de agendamento responsiva, em português.
- Consulta dos serviços, barbeiros e horários ocupados.
- Validação do agendamento pela API e no banco de dados.
- Prevenção de horários sobrepostos, inclusive quando duas pessoas reservam ao mesmo tempo.
- Confirmação de agendamento e lembrete automático por e-mail.
- Serviços e barbeiros de exemplo para facilitar a configuração inicial.

## Tecnologias

| Parte | Tecnologia |
| --- | --- |
| Servidor e API | Node.js, TypeScript e Express |
| Banco de dados | PostgreSQL |
| Validação de dados | Zod |
| E-mail | Nodemailer e SMTP |
| Interface | HTML, CSS e JavaScript |
| Testes | Node.js Test Runner e `tsx` |

## Como funciona a proteção contra conflitos

Antes de salvar uma reserva, a API calcula o horário de término a partir da duração do serviço. Além de validar os dados e o horário de funcionamento, o PostgreSQL aplica uma restrição de exclusão que proíbe intervalos sobrepostos para o mesmo barbeiro.

Essa proteção acontece no próprio banco, então continua valendo mesmo quando duas requisições chegam praticamente ao mesmo tempo. A reserva que não puder ser feita recebe `409 Conflict`, e a interface pede que o cliente escolha outro horário.

Os intervalos seguem o padrão **[início, fim)**: um atendimento pode começar exatamente quando o anterior termina.

## Requisitos

- Node.js 20 ou mais recente.
- PostgreSQL 14 ou mais recente.
- Um banco PostgreSQL e um usuário com permissão para criar tabelas e a extensão `btree_gist`.
- Uma chave de API e um remetente verificado no Resend, caso queira enviar e-mails.

## Instalação

### 1. Obtenha o projeto e instale as dependências

Abra um terminal na pasta do projeto:

```bash
npm install
```

### 2. Crie o banco

No pgAdmin, crie um banco chamado `agenda_barbearia`.

### 3. Configure o ambiente

Copie `.env.example` para `.env`, na mesma pasta do `package.json`. No Windows, por exemplo, você pode usar:

```powershell
Copy-Item .env.example .env
```

Abra `.env` e atualize os valores da conexão PostgreSQL. O usuário, a senha e o endereço de exemplo não são necessariamente os mesmos da sua instalação:

```env
PORT=3000
DATABASE_URL=postgres://USUARIO:SENHA@localhost:5432/agenda_barbearia
BUSINESS_TIME_ZONE=America/Sao_Paulo
```

### 4. Crie as tabelas e os dados de demonstração

```bash
npm run db:setup
```

Esse comando executa [`database/schema.sql`](./database/schema.sql), cria as tabelas e a restrição contra conflitos e inclui serviços e barbeiros iniciais. O banco precisa existir antes de executar o comando.

### 5. Inicie a aplicação

Para desenvolvimento:

```bash
npm run dev
```

Abra <http://localhost:3000>. Para verificar a conexão com o banco, acesse <http://localhost:3000/api/health>; uma instalação pronta responde:

```json
{"status":"ok"}
```

Para compilar e iniciar a versão de produção:

```bash
npm run build
npm start
```

## Configurar e-mail com Resend

No painel do Resend, crie uma API Key e configure um domínio verificado para poder enviar e-mails aos clientes. Adicione estas variáveis ao `.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=SUA_CHAVE_DE_API_DO_RESEND
SMTP_FROM="Ateliê Barbearia <agenda@seudominio.com>"
```

Substitua a chave pelo segredo gerado no Resend e o endereço do remetente por um endereço permitido pelo domínio verificado. Não use a chave de exemplo nem envie sua chave a outras pessoas.

Depois de salvar o `.env`, reinicie o servidor. A confirmação é enviada quando o cliente agenda. O processo verifica a cada minuto se há agendamentos confirmados nas próximas 24 horas e envia o lembrete correspondente.

**Proteja o `.env`.** Ele contém credenciais e não deve ser enviado ao GitHub nem compartilhado. O `.gitignore` deste projeto já exclui esse arquivo do Git.

## API

As respostas e os dados enviados pela API usam JSON.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Verifica a conexão com o PostgreSQL. |
| `GET` | `/api/services` | Lista os serviços ativos, com duração e preço. |
| `GET` | `/api/professionals` | Lista os barbeiros ativos. |
| `GET` | `/api/appointments?from=<ISO>&to=<ISO>&professionalId=<id>` | Consulta agendamentos que ocupam um intervalo. |
| `POST` | `/api/appointments` | Cria um agendamento. |

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

Envie `startsAt` como data e hora ISO 8601 com fuso, como no exemplo. A duração é definida pelo serviço escolhido, não pelo navegador.

### Regras de agendamento

- O horário precisa estar no futuro.
- A barbearia atende de segunda a sábado, entre 9h e 19h, considerando `BUSINESS_TIME_ZONE`.
- O atendimento inteiro deve caber no horário de funcionamento.
- Um barbeiro não pode ter dois agendamentos confirmados sobrepostos.
- Serviços e barbeiros inativos não aceitam novas reservas.
- O código de resposta `409` indica que outra reserva ocupou o horário primeiro.

## Banco de dados

O script [`database/schema.sql`](./database/schema.sql) define:

- `professionals`: barbeiros e seu estado de atividade.
- `services`: nome, duração, preço e estado de atividade.
- `appointments`: cliente, serviço, barbeiro, horário, estado e controle dos lembretes.

Os preços são armazenados em centavos para evitar imprecisões de ponto flutuante. Os horários são armazenados com fuso (`TIMESTAMPTZ`).

## Testes e compilação

Execute os testes das regras de horário:

```bash
npm test
```

Confira também a compilação TypeScript:

```bash
npm run build
```

## Estrutura do projeto

```text
database/
  schema.sql           Tabelas, regras de concorrência e dados de exemplo
public/
  index.html           Página de agendamento
  styles.css           Estilos e layout responsivo
  app.js               Consulta de disponibilidade e envio do agendamento
src/
  booking-rules.ts     Regras de horário
  database.ts          Conexão com PostgreSQL
  email.ts             Confirmações e lembretes
  server.ts            API e inicialização do servidor
  setup-database.ts    Preparação inicial do banco
tests/
  booking-rules.test.ts
```

## Limitações atuais

Esta versão resolve o fluxo público de agendamento, mas ainda não é uma plataforma completa de gestão. Ela não tem:

- Painel administrativo protegido para gerenciar a barbearia.
- Interface para cadastrar serviços e barbeiros ou alterar preços.
- Cancelamento ou remarcação pela pessoa cliente.
- Disponibilidade e horários de trabalho configuráveis por profissional.
- Pagamentos online.

Os serviços, os barbeiros e os horários de funcionamento precisam ser ajustados no código ou diretamente no banco de dados. Antes de usar em um estabelecimento real, combine com o barbeiro suas regras de atendimento, cancelamento e disponibilidade.

## Antes de publicar para clientes

Para oferecer o sistema como um serviço de produção, planeje:

- Hospedagem para a aplicação e PostgreSQL gerenciado.
- Domínio próprio e HTTPS.
- Domínio de envio verificado no Resend e tratamento de falhas de e-mail.
- Backups e monitoramento do servidor e do banco.
- Segurança, privacidade e atendimento às obrigações aplicáveis da LGPD.
- Área administrativa com autenticação e permissões adequadas.
- Testes completos com dados e horários reais do estabelecimento.

> A agenda já pode ser executada localmente após a configuração do banco e do arquivo `.env`. Uma instalação local, por si só, não deixa o site acessível aos clientes pela internet.

---

<div align="center">

Feito para deixar a reserva mais simples — para quem corta e para quem agenda.

</div>

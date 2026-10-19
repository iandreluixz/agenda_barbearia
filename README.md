<div align="center">

# ✂️ Ateliê Barbearia

### Seu próximo corte começa com um horário marcado.

Uma página de agendamento para barbearia, com serviços, profissionais, escolha de data e horário, confirmação por e-mail e proteção contra reservas simultâneas.

**Node.js · TypeScript · Express · PostgreSQL**

</div>

---

## 📌 Índice

- [💈 Sobre o projeto](#-sobre-o-projeto)
- [✨ Funcionalidades](#-funcionalidades)
- [🧰 Tecnologias](#-tecnologias)
- [⚙️ Como executar](#️-como-executar)
- [📧 Configurar e-mail com Resend](#-configurar-e-mail-com-resend)
- [🛡️ Agendamentos simultâneos](#️-agendamentos-simultâneos)
- [🔌 API](#-api)
- [🗃️ Banco de dados](#️-banco-de-dados)
- [🧪 Testes e compilação](#-testes-e-compilação)
- [🗂️ Estrutura do projeto](#️-estrutura-do-projeto)
- [🚀 Antes de publicar](#-antes-de-publicar)

## 💈 Sobre o projeto

O **Ateliê Barbearia** é um sistema web em português para clientes conhecerem os serviços, escolherem um barbeiro e reservarem um horário online. A aplicação valida as regras do negócio e usa uma restrição no PostgreSQL para impedir que duas reservas confirmadas ocupem horários sobrepostos do mesmo profissional.

O projeto foi pensado como uma base funcional para uma barbearia. Os serviços, preços, profissionais e contatos incluídos são demonstrativos e devem ser ajustados antes de receber clientes reais.

## ✨ Funcionalidades

### 🖥️ Experiência do cliente

- Layout responsivo para desktop e celular.
- Identidade visual de barbearia, com preto predominante, detalhes em vermelho e dourado e tipografia Barlow.
- Abertura com imagem de fundo, sobreposição escura e desfoque suave.
- Entrada animada e sequencial das frases e do botão; as animações respeitam a preferência do dispositivo por movimento reduzido.
- Formulário com tipografia ampliada para facilitar a leitura.
- Serviços com duração e preço, profissionais com ilustrações fictícias e calendário em português.
- Consulta de horários disponíveis conforme o serviço, o profissional e o dia escolhidos.
- Validação do e-mail e mensagens de retorno no formulário.
- Atalhos demonstrativos de WhatsApp e telefone.
- Galeria de estilos de corte com imagens CC0 e rostos desfocados.

### ⚙️ Regras e comunicação

- API em Express com validação dos dados usando Zod.
- Horário de funcionamento de segunda a sábado, das 9h às 19h, no fuso configurado.
- Confirmação de reserva e lembrete automático por e-mail via SMTP/Resend.
- Restrição no PostgreSQL para evitar conflitos de horário, inclusive em requisições simultâneas.

## 🧰 Tecnologias

| Área | Tecnologia |
| --- | --- |
| Servidor e API | Node.js, TypeScript e Express |
| Persistência | PostgreSQL |
| Validação de entrada | Zod |
| E-mail | Nodemailer e SMTP (Resend) |
| Interface | HTML, CSS e JavaScript |
| Testes | Node.js Test Runner e `tsx` |

## ⚙️ Como executar

### 1. Requisitos

- Node.js 20 ou mais recente.
- PostgreSQL 14 ou mais recente.
- Um banco de dados PostgreSQL e um usuário com permissão para criar tabelas e a extensão `btree_gist`.

### 2. Instale as dependências

Na pasta do projeto, execute:

```bash
npm install
```

### 3. Crie o banco PostgreSQL

No pgAdmin ou por outro cliente PostgreSQL, crie um banco chamado `agenda_barbearia`.

### 4. Configure as variáveis de ambiente

Copie o arquivo de exemplo para `.env`, na mesma pasta do `package.json`. No PowerShell do Windows:

```powershell
Copy-Item .env.example .env
```

Edite o `.env` e informe os dados corretos do seu PostgreSQL:

```env
PORT=3000
DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/agenda_barbearia
BUSINESS_TIME_ZONE=America/Sao_Paulo
```

Troque `USUARIO` e `SENHA` pelas credenciais locais do PostgreSQL. Não compartilhe nem envie seu `.env` ao GitHub: esse arquivo contém credenciais. O `.gitignore` já está configurado para ignorá-lo.

### 5. Prepare as tabelas e os dados iniciais

```bash
npm run db:setup
```

O comando executa [`database/schema.sql`](./database/schema.sql), cria as tabelas e a regra de proteção contra conflitos, além de incluir serviços e profissionais demonstrativos. O banco precisa existir antes de executar a configuração.

### 6. Inicie o sistema

Em desenvolvimento:

```bash
npm run dev
```

Acesse <http://localhost:3000>. Para verificar se o servidor consegue acessar o banco, abra <http://localhost:3000/api/health>. Quando estiver pronto, o endpoint retorna:

```json
{"status":"ok"}
```

Para compilar e iniciar o servidor compilado:

```bash
npm run build
npm start
```

## 📧 Configurar e-mail com Resend

Para enviar mensagens aos clientes, crie uma API Key no Resend e configure um domínio remetente verificado. Adicione estas variáveis ao `.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=SUA_CHAVE_DE_API_DO_RESEND
SMTP_FROM="Ateliê Barbearia <agenda@seudominio.com>"
```

Substitua `SUA_CHAVE_DE_API_DO_RESEND` pela chave secreta gerada no Resend e use em `SMTP_FROM` um endereço permitido pelo domínio verificado. Nunca coloque a chave no README, no código ou em um commit.

Depois de atualizar o `.env`, reinicie o servidor. A confirmação é enviada após a criação de um agendamento. Quando o SMTP está configurado, o servidor também verifica periodicamente os agendamentos confirmados nas próximas 24 horas para enviar lembretes. Sem SMTP configurado, a aplicação continua funcionando, mas não envia e-mails.

## 🛡️ Agendamentos simultâneos

A API calcula o fim do atendimento a partir da duração cadastrada para o serviço. Em seguida, o PostgreSQL aplica uma restrição de exclusão sobre os intervalos do mesmo profissional. Assim, se duas requisições concorrentes tentarem reservar horários sobrepostos, apenas uma é confirmada; a outra recebe `409 Conflict` e a interface informa que o horário não está mais disponível.

Os intervalos usam o padrão **[início, fim)**. Por isso, um atendimento pode começar exatamente quando o anterior termina, sem ser tratado como conflito.

Além da regra de concorrência, a API verifica que:

- o horário escolhido está no futuro;
- a data não é domingo;
- todo o atendimento cabe entre 9h e 19h no fuso `BUSINESS_TIME_ZONE`;
- o serviço e o profissional continuam ativos;
- nome e e-mail têm formato válido.

## 🔌 API

As rotas usam e retornam JSON.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Verifica a conexão com o PostgreSQL. |
| `GET` | `/api/services` | Lista serviços ativos, com duração e preço. |
| `GET` | `/api/professionals` | Lista profissionais ativos. |
| `GET` | `/api/appointments?from=<ISO>&to=<ISO>&professionalId=<id>` | Consulta horários ocupados no intervalo informado. |
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

`startsAt` deve ser uma data ISO 8601 com fuso horário. A duração do atendimento é obtida do serviço no banco, não do navegador.

## 🗃️ Banco de dados

O esquema em [`database/schema.sql`](./database/schema.sql) define:

- `professionals`: profissionais e seu estado de atividade;
- `services`: nome, duração, preço e estado de atividade;
- `appointments`: dados do cliente, serviço, profissional, intervalo, situação e estado dos lembretes.

Os preços são armazenados em centavos. Os horários usam `TIMESTAMPTZ`, e a restrição `appointments_no_overlap` impede intervalos confirmados sobrepostos para o mesmo profissional.

## 🧪 Testes e compilação

Rode os testes das regras de horário e sobreposição:

```bash
npm test
```

Verifique a compilação TypeScript:

```bash
npm run build
```

## 🗂️ Estrutura do projeto

```text
database/
  schema.sql                         Esquema, restrição de concorrência e dados iniciais
public/
  images/                             Logo, fundo, ilustrações e referências de cortes
  index.html                          Página de agendamento
  styles.css                          Identidade visual, animações e layout responsivo
  app.js                              Calendário, disponibilidade e formulário
src/
  booking-rules.ts                    Regras de horário e sobreposição
  database.ts                         Conexão com PostgreSQL
  email.ts                            Confirmações e lembretes por e-mail
  server.ts                           API e inicialização do servidor
  setup-database.ts                   Preparação inicial do banco
tests/
  booking-rules.test.ts               Testes das regras de agendamento
.env.example                          Modelo de configuração local
```

## 🖼️ Imagens e contatos demonstrativos

As imagens da galeria de cortes são referências CC0 do Wikimedia Commons; a página inclui links para a origem e a licença. Os rostos das imagens de referência foram desfocados. Os cartões dos profissionais usam ilustrações SVG fictícias, não fotografias de pessoas reais. A imagem de fundo foi fornecida como referência para este projeto.

O telefone `(35) 99999-9999` e os links do WhatsApp são fictícios. Antes de publicar, substitua-os por um número autorizado pela barbearia. Confirme também que há autorização para usar qualquer imagem ou dado real adicionado ao site.

## 🚀 Antes de publicar

Esta versão já pode ser executada localmente após configurar o banco e o `.env`, mas uma instalação local não deixa o site acessível aos clientes pela internet. Antes de usar comercialmente, planeje:

- hospedagem da aplicação e banco PostgreSQL gerenciado;
- domínio próprio e HTTPS;
- credenciais SMTP seguras e domínio de envio verificado;
- backups, monitoramento e procedimentos para falhas;
- autenticação e permissões para uma futura área administrativa;
- regras reais de funcionamento, disponibilidade, cancelamento e remarcação;
- privacidade, retenção dos dados e obrigações aplicáveis da LGPD;
- substituição dos serviços, profissionais, imagens e contatos demonstrativos.

### ⚠️ Limitações atuais

O sistema oferece o fluxo público de agendamento, mas ainda não inclui painel administrativo, cadastro de serviços pela interface, cancelamento ou remarcação pelo cliente, escala configurável por profissional ou pagamentos online. Serviços, profissionais e horários precisam ser gerenciados diretamente no banco ou ajustados no projeto.

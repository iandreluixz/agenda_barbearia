# Agenda da barbearia

Aplicação de agendamento feita com Node.js, TypeScript, Express e PostgreSQL. O cliente escolhe um serviço, um barbeiro, o dia e um horário livre; a API valida os dados e o banco impede que dois atendimentos confirmados se sobreponham para o mesmo profissional.

## O que você precisa

- Node.js 20 ou mais recente
- PostgreSQL 14 ou mais recente

## Preparar o projeto

1. Crie um banco chamado `agenda_barbearia` no PostgreSQL (por exemplo, pelo pgAdmin).
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` com o usuário e a senha que você configurou ao instalar o PostgreSQL. O exemplo `postgres:postgres` só funciona se esses forem realmente os dados da sua instalação.
3. Instale as dependências e prepare as tabelas e os dados de demonstração:

   ```bash
   npm install
   npm run db:setup
   ```

   O banco precisa existir antes desse comando. O usuário também deve ter permissão para criar tabelas e a extensão `btree_gist`.
4. Inicie a aplicação:

   ```bash
   npm run dev
   ```

5. Acesse <http://localhost:3000>.

Se a agenda não iniciar, confira o erro exibido no terminal. `GET /api/health` verifica a conexão e a aplicação agora informa quando a configuração, o banco ou as tabelas estão faltando.

Para compilar e iniciar a versão de produção, use `npm run build` e depois `npm start`.

## Regras principais

- O horário precisa estar no futuro, de segunda a sábado, e o atendimento deve terminar até as 19h, considerando `BUSINESS_TIME_ZONE`.
- Cada barbeiro pode ter somente um agendamento confirmado por vez. A restrição de exclusão do PostgreSQL é a garantia final contra duas requisições simultâneas; a API responde `409 Conflict` quando outra reserva vence a disputa.
- Os horários consecutivos são permitidos. O intervalo usa o padrão `[início, fim)`, então um atendimento pode começar exatamente quando o anterior termina.
- Cancelamentos não são incluídos nesta primeira versão.

## API

- `GET /api/services` — lista os serviços ativos.
- `GET /api/professionals` — lista os barbeiros ativos.
- `GET /api/appointments?from=<ISO>&to=<ISO>&professionalId=<id>` — consulta horários ocupados.
- `POST /api/appointments` — cria um agendamento.

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

## E-mail e lembretes

Sem configuração de SMTP, os agendamentos continuam funcionando e os e-mails ficam desativados. Para enviar confirmação e lembrete automático, preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` no `.env`. O serviço verifica a cada minuto se há agendamentos confirmados nas próximas 24 horas.

## Testes

```bash
npm test
```

## Antes de oferecer para uso comercial

Esta versão é uma base funcional, ainda não um serviço pronto para produção. Antes de publicar para um estabelecimento, defina hospedagem com HTTPS e banco gerenciado, configure domínio e e-mail, substitua os dados de demonstração pelos dados reais e valide horários, preços e regras de cancelamento com o barbeiro. Para uso real, também planeje uma área administrativa protegida, controle de acesso, política de privacidade/LGPD, cópias de segurança e monitoramento. O sistema ainda não tem painel administrativo, cancelamento pelo cliente, pagamentos nem gestão de disponibilidade personalizada.

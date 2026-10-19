import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { ZodError, z } from "zod";
import { isWithinBusinessHours } from "./booking-rules.js";
import { pool } from "./database.js";
import { sendConfirmation, sendDueReminders } from "./email.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const businessTimeZone =
  process.env.BUSINESS_TIME_ZONE ?? "America/Sao_Paulo";

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/services", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, duration_minutes, price_cents
         FROM services
        WHERE active = TRUE
        ORDER BY name`,
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/professionals", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM professionals WHERE active = TRUE ORDER BY name",
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/appointments", async (request, response, next) => {
  try {
    const query = z
      .object({
        from: z.string().datetime({ offset: true }),
        to: z.string().datetime({ offset: true }),
        professionalId: z.coerce.number().int().positive(),
      })
      .parse(request.query);

    const { rows } = await pool.query(
      `SELECT starts_at, ends_at
         FROM appointments
        WHERE professional_id = $1
          AND status = 'confirmed'
          AND starts_at < $3
          AND ends_at > $2
        ORDER BY starts_at`,
      [query.professionalId, query.from, query.to],
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/appointments", async (request, response, next) => {
  try {
    const input = z
      .object({
        customerName: z.string().trim().min(2).max(100),
        customerEmail: z.string().trim().email().max(254),
        professionalId: z.number().int().positive(),
        serviceId: z.number().int().positive(),
        startsAt: z.string().datetime({ offset: true }),
      })
      .parse(request.body);

    const startsAt = new Date(input.startsAt);
    if (startsAt <= new Date()) {
      response.status(400).json({ error: "Escolha um horário no futuro." });
      return;
    }

    const { rows: services } = await pool.query<{
      name: string;
      duration_minutes: number;
    }>(
      "SELECT name, duration_minutes FROM services WHERE id = $1 AND active = TRUE",
      [input.serviceId],
    );
    const { rows: professionals } = await pool.query<{ name: string }>(
      "SELECT name FROM professionals WHERE id = $1 AND active = TRUE",
      [input.professionalId],
    );
    const service = services[0];
    const professional = professionals[0];

    if (!service || !professional) {
      response.status(404).json({
        error: "O serviço ou profissional selecionado não está disponível.",
      });
      return;
    }

    const endsAt = new Date(
      startsAt.getTime() + service.duration_minutes * 60_000,
    );
    if (!isWithinBusinessHours(startsAt, endsAt, businessTimeZone)) {
      response.status(400).json({
        error: "O atendimento deve acontecer entre 9h e 19h.",
      });
      return;
    }

    const { rows } = await pool.query<{
      id: number;
      starts_at: Date;
      ends_at: Date;
    }>(
      `INSERT INTO appointments
          (customer_name, customer_email, professional_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, starts_at, ends_at`,
      [
        input.customerName,
        input.customerEmail,
        input.professionalId,
        input.serviceId,
        startsAt,
        endsAt,
      ],
    );
    const appointment = rows[0];

    let confirmationSent = false;
    try {
      confirmationSent = await sendConfirmation(
        input.customerEmail,
        input.customerName,
        service.name,
        appointment.starts_at,
        professional.name,
      );
    } catch (error) {
      console.error("Agendamento criado, mas o e-mail de confirmação falhou:", error);
    }

    response.status(201).json({
      id: appointment.id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      confirmationSent,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23P01"
    ) {
      response.status(409).json({
        error: "Esse horário acabou de ser reservado. Escolha outro.",
      });
      return;
    }
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Confira os dados informados.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    console.error("Erro ao processar a solicitação:", error);
    response.status(500).json({ error: "Não foi possível concluir a solicitação." });
  },
);

async function startServer(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    const { rows } = await pool.query<{
      professionals: string | null;
      services: string | null;
      appointments: string | null;
    }>(
      `SELECT to_regclass('public.professionals') AS professionals,
              to_regclass('public.services') AS services,
              to_regclass('public.appointments') AS appointments`,
    );
    const tables = rows[0];
    const missingTables = Object.entries(tables)
      .filter(([, table]) => table === null)
      .map(([name]) => name);

    if (missingTables.length > 0) {
      throw new Error(
        `O banco está acessível, mas faltam as tabelas: ${missingTables.join(", ")}. Execute npm run db:setup.`,
      );
    }
  } catch (error) {
    console.error("Não foi possível iniciar a agenda.");
    console.error(
      "Confira se o PostgreSQL está ativo, se o banco informado em DATABASE_URL existe e se as tabelas foram criadas com npm run db:setup.",
    );
    console.error(error);
    await pool.end();
    process.exitCode = 1;
    return;
  }

  app.listen(port, () => {
    console.log(`Agenda disponível em http://localhost:${port}`);
    if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
      void sendDueReminders(pool).catch((error: unknown) => {
        console.error("Erro ao verificar lembretes:", error);
      });
      setInterval(() => {
        void sendDueReminders(pool).catch((error: unknown) => {
          console.error("Erro ao verificar lembretes:", error);
        });
      }, 60_000);
    } else {
      console.log("E-mails desativados; configure SMTP_HOST e SMTP_FROM para ativar.");
    }
  });
}

void startServer();

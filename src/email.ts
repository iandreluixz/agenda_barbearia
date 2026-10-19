import nodemailer from "nodemailer";
import type { Pool } from "pg";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.SMTP_FROM;

const transporter = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
  : null;

export async function sendConfirmation(
  to: string,
  customerName: string,
  serviceName: string,
  startsAt: Date,
  professionalName: string,
): Promise<boolean> {
  if (!transporter || !emailFrom) return false;

  await transporter.sendMail({
    from: emailFrom,
    to,
    subject: "Seu horário está confirmado",
    text: `Olá, ${customerName}! Seu horário para ${serviceName} com ${professionalName} está confirmado para ${startsAt.toLocaleString("pt-BR", { timeZone: process.env.BUSINESS_TIME_ZONE ?? "America/Sao_Paulo" })}.`,
  });
  return true;
}

export async function sendDueReminders(pool: Pool): Promise<void> {
  if (!transporter || !emailFrom) return;

  const { rows } = await pool.query<{
    id: number;
    customer_name: string;
    customer_email: string;
    service_name: string;
    professional_name: string;
    starts_at: Date;
  }>(
    `WITH due AS (
       SELECT id
         FROM appointments
        WHERE status = 'confirmed'
          AND reminder_sent_at IS NULL
          AND (reminder_claimed_at IS NULL
               OR reminder_claimed_at < NOW() - INTERVAL '10 minutes')
          AND starts_at > NOW()
          AND starts_at <= NOW() + INTERVAL '24 hours'
        ORDER BY starts_at
        LIMIT 50
        FOR UPDATE SKIP LOCKED
     ),
     claimed AS (
       UPDATE appointments a
          SET reminder_claimed_at = NOW()
         FROM due
        WHERE a.id = due.id
        RETURNING a.id
     )
     SELECT a.id, a.customer_name, a.customer_email, s.name AS service_name,
            p.name AS professional_name, a.starts_at
       FROM appointments a
       JOIN claimed c ON c.id = a.id
       JOIN services s ON s.id = a.service_id
       JOIN professionals p ON p.id = a.professional_id`,
  );

  for (const appointment of rows) {
    try {
      await transporter.sendMail({
        from: emailFrom,
        to: appointment.customer_email,
        subject: "Lembrete: seu horário é amanhã",
        text: `Olá, ${appointment.customer_name}! Lembramos que você tem ${appointment.service_name} com ${appointment.professional_name} em ${appointment.starts_at.toLocaleString("pt-BR", { timeZone: process.env.BUSINESS_TIME_ZONE ?? "America/Sao_Paulo" })}.`,
      });
      await pool.query(
        `UPDATE appointments
            SET reminder_sent_at = NOW(), reminder_claimed_at = NULL
          WHERE id = $1`,
        [appointment.id],
      );
    } catch (error) {
      console.error(
        `Não foi possível enviar o lembrete do agendamento ${appointment.id}:`,
        error,
      );
      await pool.query(
        "UPDATE appointments SET reminder_claimed_at = NULL WHERE id = $1",
        [appointment.id],
      );
    }
  }
}

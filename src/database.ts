import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não foi configurada. Copie .env.example para .env e configure a conexão com o PostgreSQL.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (error) => {
  console.error("Erro inesperado na conexão com o banco de dados:", error);
});

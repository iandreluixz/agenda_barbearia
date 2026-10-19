import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./database.js";

async function setupDatabase(): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), "database", "schema.sql");
  const schema = await readFile(schemaPath, "utf8");

  await pool.query(schema);
  console.log("Tabelas e dados iniciais criados com sucesso.");
}

setupDatabase()
  .catch((error: unknown) => {
    console.error(
      "Não foi possível preparar o banco. Confirme que o banco informado em DATABASE_URL já existe e que o usuário tem permissão para criar tabelas e a extensão btree_gist.",
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

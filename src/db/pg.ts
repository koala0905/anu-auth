import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "anu",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

pool.on("error", (err) => {
  console.error("[PG Error]", err);
});

pool.on("connect", () => {
  console.log("[PG] connected");
});

export default pool;

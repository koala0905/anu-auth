import express from "express";
import { config } from "./config.js";
import provider from "#/provider.js";
import { Redis } from "ioredis";
import pool from "#/db/pg.js";
import interactionRouter from "./routes/interaction/index.js";
import path from "node:path";

const app = express();
const port = config.port;

app.set("view engine", "ejs");
//app.set("views", "./views");
app.set("views", path.join(import.meta.dirname, "views"));
app.use(express.urlencoded({ extended: false }));

// app.get("/interaction/:uid/confirm", async (req, res) => {
//   try {
//     const sub = req.query.sub as string;
//     if (!sub) {
//       res.status(400).json({ error: "missing sub parameter" });
//       return;
//     }

//     const result = {
//       login: { accountId: sub },
//       consent: {},
//     };

//     await provider.interactionFinished(req, res, result);
//   } catch (err) {
//     console.error("Interaction confirm error:", err);
//     res.status(500).json({ error: "internal server error" });
//   }
// });

app.use("/interaction", interactionRouter);

app.use("/", provider.callback());

async function main() {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    process.exit(1);
  }

  try {
    const redisTester = new Redis(config.redis.url);
    await redisTester.ping();
    await redisTester.quit();
  } catch (err) {
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`[Auth Server] running on http://auth.localhost:${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start the server:", err);
  process.exit(1);
});

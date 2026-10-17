import { Redis } from "ioredis";
import { config } from "#/config.js";

export const appRedis = new Redis(config.redis.url);

appRedis.on("error", (err) => {
  console.error("[Redis Error]", err);
});

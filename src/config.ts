import dotenv from "dotenv";
dotenv.config();

export const config = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}",
  },
  issuer: process.env.ISSUER_URL || "http://auth.localhost",
  accountAppUrl: process.env.ACCOUNT_APP_URL || "http://account.localhost",
  cookieKeys: (process.env.COOKIE_SECRET || "change-me").split(","),
  port: parseInt(process.env.PORT || "3000", 10),
};

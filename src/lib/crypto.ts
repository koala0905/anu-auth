import crypto from "node:crypto";
import { config } from "#/config.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  const dataParts = parts[0] === VERSION ? parts.slice(1) : parts;

  if (dataParts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivB64, tagB64, dataB64] = dataParts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  if (
    iv.length !== IV_LENGTH ||
    tag.length !== TAG_LENGTH ||
    data.length === 0
  ) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    config.mfa.encryptionKey,
    iv,
    { authTagLength: TAG_LENGTH },
  );
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

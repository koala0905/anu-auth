import { Request, Response } from "express";
import provider from "../../provider.js";
import bcrypt from "bcrypt";
import { findUserByUsernameWithCredentials } from "#/db/users.js";
import { getMfaSecret } from "#/db/mfa.js";
import { decryptSecret } from "#/lib/crypto.js";
import { appRedis } from "#/lib/redis.js";
import { mfaPendingKey, MFA_PENDING_TTL_SECONDS } from "./mfa.js";

export async function login(req: Request, res: Response, details: any) {
  const error =
    typeof req.query.error === "string" ? req.query.error : undefined;

  return res.render("interaction/login", {
    uid: details.uid,
    error,
  });
}

export async function loginSubmit(req: Request, res: Response, details: any) {
  const { username, password } = req.body;

  const user = await findUserByUsernameWithCredentials(username);
  if (!user || !user.password_hash) {
    return res.render("interaction/login", {
      uid: details.uid,
      error: "Invalid username or password",
    });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.render("interaction/login", {
      uid: details.uid,
      error: "Invalid username or password",
    });
  }

  if (user.mfa_enabled) {
    const encryptedSecret = await getMfaSecret(user.id);
    if (!encryptedSecret) {
      console.error(
        `[login] user ${user.id} has mfa_enabled but no confirmed TOTP secret`,
      );
      return res.render("interaction/login", {
        uid: details.uid,
        error: "MFA is not properly configured. Please contact support.(1)",
      });
    }

    let secret: string;
    try {
      secret = decryptSecret(encryptedSecret);
    } catch (err) {
      console.error("[login] failed to decrypt MFA secret:", err);
      return res.render("interaction/login", {
        uid: details.uid,
        error: "MFA is not properly configured. Please contact support.(2)",
      });
    }

    await appRedis.set(
      mfaPendingKey(details.uid),
      JSON.stringify({ accountId: user.id, secret, amr: ["pwd"] }),
      "EX",
      MFA_PENDING_TTL_SECONDS,
    );

    return res.redirect(`/interaction/${details.uid}/mfa`);
  }

  await provider.interactionFinished(req, res, {
    login: { accountId: user.id, amr: ["pwd"] },
    consent: {},
  });
}

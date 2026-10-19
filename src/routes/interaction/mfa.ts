import { Request, Response } from "express";
import * as OTPAuth from "otpauth";
import provider from "#/provider.js";
import { appRedis } from "#/lib/redis.js";
import { touchMfaLastUsed } from "#/db/mfa.js";

export const MFA_PENDING_TTL_SECONDS = 300;

export interface PendingMfa {
  accountId: string;
  secret: string;
  amr: string[];
}

export function mfaPendingKey(uid: string): string {
  return `mfa:pending:${uid}`;
}

async function getPending(uid: string): Promise<PendingMfa | null> {
  const raw = await appRedis.get(mfaPendingKey(uid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingMfa;
  } catch {
    return null;
  }
}

export async function mfaGet(req: Request, res: Response, details: any) {
  const error =
    typeof req.query.error === "string" ? req.query.error : undefined;

  const pending = await getPending(details.uid);
  if (!pending) {
    return res.redirect(`/interaction/${details.uid}`);
  }

  return res.render("interaction/mfa", {
    uid: details.uid,
    error,
  });
}

export async function mfaSubmit(req: Request, res: Response, details: any) {
  const pending = await getPending(details.uid);
  if (!pending) {
    return res.redirect(`/interaction/${details.uid}`);
  }

  const token = String(req.body?.token ?? "").trim();

  const totp = new OTPAuth.TOTP({
    issuer: "anu-auth",
    label: pending.accountId,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(pending.secret),
  });

  const delta = totp.validate({ token, window: 1 });
  if (delta === null) {
    return res.render("interaction/mfa", {
      uid: details.uid,
      error: "Invalid verification code",
    });
  }

  await appRedis.del(mfaPendingKey(details.uid));

  try {
    await touchMfaLastUsed(pending.accountId);
  } catch (err) {
    console.error("[mfa] failed to update last_used_at:", err);
  }

  await provider.interactionFinished(req, res, {
    login: { accountId: pending.accountId, amr: [...pending.amr, "otp"] },
    consent: {},
  });
}

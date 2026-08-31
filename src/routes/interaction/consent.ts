import { Request, Response } from "express";
import provider from "../../provider.js";
import { findClientById } from "#/db/clients.js";
import { findUserById } from "#/db/users.js";

export async function consent(req: Request, res: Response, details: any) {
  const error =
    typeof req.query.error === "string" ? req.query.error : undefined;

  const client = await findClientById(details.params?.client_id);
  const user = await findUserById(details.session?.accountId);

  return res.render("interaction/consent", {
    uid: details.uid,
    clientName: client?.client_name || undefined,
    userEmail: user?.email || undefined,
    scopes: details.prompt?.details?.missingOIDCScope ?? [],
    error,
  });
}

export async function consentSubmit(req: Request, res: Response, details: any) {
  const accountId = details.session?.accountId;
  const clientId = details.params?.client_id;

  // 安全檢查：若 session 沒 accountId（沒登入過），回到 interaction 重來
  if (!accountId || !clientId) {
    return res.redirect(`/interaction/${details.uid}`);
  }

  // 處理 deny
  if (req.body?.action === "deny") {
    return provider.interactionFinished(req, res, {
      error: "access_denied",
    });
  }

  // allow：建立 grant
  const grant = new provider.Grant({
    accountId,
    clientId,
  });

  if (details.prompt?.details?.missingOIDCScope) {
    const scopes: string[] = details.prompt.details.missingOIDCScope;
    grant.addOIDCScope(scopes);
  }
  if (details.prompt?.details?.missingOIDCClaims) {
    const claims: string[] = details.prompt.details.missingOIDCClaims;
    grant.addOIDCClaims(claims);
  }

  const grantId = await grant.save();

  console.log(
    "[interaction] consentSubmit: grantId:",
    grantId,
    "details",
    details.prompt?.details,
  );

  await provider.interactionFinished(req, res, {
    login: { accountId },
    consent: { grantId },
  });
}

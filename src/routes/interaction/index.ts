import { Router } from "express";
import provider from "#/provider.js";
import { login, loginSubmit } from "./login.js";
import { consent, consentSubmit } from "./consent.js";
import { mfaGet, mfaSubmit } from "./mfa.js";

type PromptDetails = {
  missingOIDCScope?: string[];
  missingOIDCClaims?: string[];
};

const router = Router();

router.get("/:uid", async (req, res) => {
  const details = await provider.interactionDetails(req, res);
  switch (details.prompt.name) {
    case "login":
      return login(req, res, details);

    case "consent":
      return consent(req, res, details);

    default:
      return res.status(501).send("unsupported prompt");
  }
});

router.get("/:uid/mfa", async (req, res) => {
  try {
    const details = await provider.interactionDetails(req, res);
    return await mfaGet(req, res, details);
  } catch (err) {
    console.error("[interaction] mfa GET error:", err);
    return res.redirect("/");
  }
});

router.post("/:uid/mfa", async (req, res) => {
  try {
    const details = await provider.interactionDetails(req, res);
    return await mfaSubmit(req, res, details);
  } catch (err) {
    console.error("[interaction] mfa POST error:", err);
    return res.redirect("/");
  }
});

router.post("/:uid", async (req, res) => {
  try {
    const details = await provider.interactionDetails(req, res);

    switch (details.prompt.name) {
      case "login":
        return await loginSubmit(req, res, details);
      case "consent":
        return await consentSubmit(req, res, details);
      default:
        return res.status(501).send("unsupported prompt");
    }
  } catch (err) {
    // interactionDetail 會因 session 過期等 error——錯誤時 redirect 回首頁或回 /authorize
    console.error("[interaction] error:", err);
    return res.redirect("/");
  }
});

export default router;

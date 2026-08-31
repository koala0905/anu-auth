import { Router } from "express";
import provider from "#/provider.js";
import { login, loginSubmit } from "./login.js";
import { consent, consentSubmit } from "./consent.js";

type PromptDetails = {
  missingOIDCScope?: string[];
  missingOIDCClaims?: string[];
};

const router = Router();

router.get("/:uid", async (req, res) => {
  const details = await provider.interactionDetails(req, res);
  console.log("[interaction] GET details:", JSON.stringify(details));
  switch (details.prompt.name) {
    case "login":
      return login(req, res, details);

    case "consent":
      return consent(req, res, details);

    default:
      return res.status(501).send("unsupported prompt");
  }
});

router.post("/:uid", async (req, res) => {
  try {
    const details = await provider.interactionDetails(req, res);
    console.log("[interaction] POST details:", JSON.stringify(details));
    console.log(
      "[consentSubmit] missingOIDCScope:",
      details.prompt?.details?.missingOIDCScope,
    );
    console.log(
      "[consentSubmit] missingOIDCClaims:",
      details.prompt?.details?.missingOIDCClaims,
    );
    console.log("[consentSubmit] params.scope:", details.params?.scope);

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

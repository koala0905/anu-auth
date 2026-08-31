import { Request, Response } from "express";
import provider from "../../provider.js";
import bcrypt from "bcrypt";
import { findUserByUsernameWithCredentials } from "#/db/users.js";

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

  await provider.interactionFinished(req, res, {
    login: { accountId: user.id },
    consent: {},
  });
}

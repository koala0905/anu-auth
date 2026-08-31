import { Request, Response } from "express";

type LoginViewOptions = {
  uid: string;
  error?: string;
};

export async function loginView(
  req: Request,
  res: Response,
  options: LoginViewOptions,
) {
  const { uid, error } = options;

  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <title>Sign in</title>
      </head>

      <body>
        <main>
          <h1>Sign in</h1>

          ${error ? `<p role="alert">${escapeHtml(error)}</p>` : ""}

          <form method="post">

            <div>
              <label for="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autocomplete="username"
                required
              />
            </div>

            <div>
              <label for="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                required
              />
            </div>

            <button type="submit">
              Sign in
            </button>
          </form>
        </main>
      </body>
    </html>
  `);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

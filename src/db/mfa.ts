import pool from "./pg.js";

export async function getMfaSecret(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `
    SELECT secret
    FROM mfa
    WHERE user_id = $1
      AND type = 'totp'
      AND confirmed_at IS NOT NULL
      AND deleted_at IS NULL
    ORDER BY confirmed_at DESC, created_at DESC
    LIMIT 1;
    `,
    [userId],
  );
  return rows[0]?.secret ?? null;
}

export async function touchMfaLastUsed(userId: string): Promise<void> {
  await pool.query(
    `
    UPDATE mfa
    SET last_used_at = now(),
        updated_at = now()
    WHERE user_id = $1
      AND type = 'totp'
      AND confirmed_at IS NOT NULL
      AND deleted_at IS NULL;
    `,
    [userId],
  );
}

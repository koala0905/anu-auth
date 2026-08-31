import pool from "./pg.js";

export interface User {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name: string | null;
  family_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface UserCredentials {
  id: string;
  username: string;
  password_hash: string | null;
}

export async function findUserByUsernameWithCredentials(
  username: string,
): Promise<UserCredentials | null> {
  const { rows } = await pool.query(
    `
    SELECT id, username, password_hash
    FROM users
    WHERE username = $1
      AND deleted_at IS NULL;
    `,
    [username.toLowerCase()],
  );
  return rows[0] || null;
}

export async function findUserByUsername(
  username: string,
): Promise<User | null> {
  const { rows } = await pool.query(
    `
    SELECT
      u.id AS sub,
      u.email,
      u.email_verified,
      p.given_name,
      p.family_name,
      p.display_name,
      p.avatar_url
    FROM users u
    LEFT JOIN profiles p
        ON p.user_id = u.id
    WHERE u.username = $1
      AND u.deleted_at IS NULL;
    `,
    [username.toLowerCase()],
  );
  return rows[0] || null;
}

export async function findUserById(sub: string): Promise<User | null> {
  const { rows } = await pool.query(
    `
  SELECT
    u.id AS sub,
    u.email,
    u.email_verified,
    p.given_name,
    p.family_name,
    p.display_name,
    p.avatar_url
  FROM users u
  LEFT JOIN profiles p
      ON p.user_id = u.id
  WHERE u.id = $1
    AND u.deleted_at IS NULL;
  `,
    [sub],
  );
  return rows[0] || null;
}

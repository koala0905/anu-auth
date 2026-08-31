import pool from "./pg";

export interface ClientRecord {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  client_name: string | null;
  logo_uri: string | null;
  post_logout_redirect_uris?: string[];
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
}

export async function findClientById(
  clientId: string,
): Promise<ClientRecord | null> {
  const { rows } = await pool.query(
    `
    SELECT 
      client_id,
      client_secret,
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      allowed_scopes,
      required_scopes,
      token_endpoint_auth_method,
      policy_uri,
      post_logout_redirect_uris,
      tos_uri,
      logo_uri,
      jwks_uri
    FROM clients
    WHERE 
      client_id = $1
      AND status = 'active'
      AND deleted_at is null
    `,
    [clientId],
  );
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  const client: ClientRecord = {
    client_id: row.client_id,
    client_secret: row.client_secret,
    redirect_uris: row.redirect_uris,
    grant_types: row.grant_types,
    response_types: row.response_types,
    token_endpoint_auth_method: row.token_endpoint_auth_method,
    scope: row.allowed_scopes.join(" "),
    client_name: row.client_name,
    logo_uri: row.logo_uri ?? null,
    post_logout_redirect_uris: row.post_logout_redirect_uris ?? undefined,
    policy_uri: row.policy_uri ?? undefined,
    tos_uri: row.tos_uri ?? undefined,
    jwks_uri: row.jwks_uri ?? undefined,
  };
  return client;
}

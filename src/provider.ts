import * as oidc from "oidc-provider";
import { config } from "#/config.js";
import RedisAdapter from "#/adapters/redis.js";
import { findUserById } from "./db/users.js";

const provider = new oidc.Provider(config.issuer, {
  adapter: RedisAdapter,
  clients: [],
  cookies: {
    keys: config.cookieKeys,
  },
  interactions: {
    url(ctx, interaction) {
      return `/interaction/${interaction.uid}`;
    },
  },
  features: {
    devInteractions: { enabled: false },
    deviceFlow: { enabled: true },
    backchannelLogout: { enabled: true },
  },
  scopes: ["openid", "profile", "email"],
  claims: {
    openid: ["sub"],
    email: ["email", "email_verified"],
    profile: ["given_name", "family_name", "display_name", "picture"],
  },
  findAccount: async (_ctx, sub) => {
    const user = await findUserById(sub);
    console.log("[findAccount] sub:", sub, "user:", user);
    if (!user) return undefined;
    return {
      accountId: sub,
      async claims(use, scope) {
        return {
          sub: user.sub,

          ...(scope.includes("email") && {
            email: user.email,
            email_verified: user.email_verified,
          }),

          ...(scope.includes("profile") && {
            given_name: user.given_name,
            family_name: user.family_name,
            display_name: user.display_name,
            picture: user.avatar_url ?? "",
          }),
        };
      },
    };
  },
});

export default provider;

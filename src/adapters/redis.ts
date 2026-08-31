import { Redis } from "ioredis";
import { config } from "#/config.js";
import { findClientById } from "#/db/clients.js";

const redis = new Redis(config.redis.url, { keyPrefix: "oidc:" });
redis.on("error", (err) => {
  console.error("[Redis Error]", err);
});

redis.on("connect", () => {
  console.log("[Redis] connected");
});

const grantable = new Set([
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "BackchannelAuthenticationRequest",
]);

const consumable = new Set([
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "BackchannelAuthenticationRequest",
  "PushedAuthorizationRequest",
]);

function grantKeyFor(id: string) {
  return `grant:${id}`;
}
function userCodeKeyFor(userCode: string) {
  return `userCode:${userCode}`;
}
function uidKeyFor(uid: string) {
  return `uid:${uid}`;
}

class RedisAdapter {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  key(id: string) {
    return `${this.name}:${id}`;
  }

  async upsert(
    id: string,
    payload: Record<string, unknown>,
    expiresIn: number,
  ) {
    if (this.name === "Client") return;

    const key = this.key(id);
    const isConsumable = consumable.has(this.name);
    const store = isConsumable
      ? { payload: JSON.stringify(payload) }
      : JSON.stringify(payload);

    const multi = redis.multi();
    if (isConsumable) {
      multi.hmset(key, store as Record<string, string>);
    } else {
      multi.set(key, store as string);
    }

    if (expiresIn) {
      multi.expire(key, expiresIn);
    }

    if (grantable.has(this.name) && payload.grantId) {
      const grantKey = grantKeyFor(payload.grantId as string);
      multi.rpush(grantKey, key);
      const ttl = await redis.ttl(grantKey);
      if (expiresIn > ttl) {
        multi.expire(grantKey, expiresIn);
      }
    }

    if (payload.userCode) {
      const userCodeKey = userCodeKeyFor(payload.userCode as string);
      multi.set(userCodeKey, id);
      if (expiresIn) multi.expire(userCodeKey, expiresIn);
    }

    if (payload.uid) {
      const uidKey = uidKeyFor(payload.uid as string);
      multi.set(uidKey, id);
      if (expiresIn) multi.expire(uidKey, expiresIn);
    }

    await multi.exec();
  }

  async find(id: string) {
    if (this.name === "Client") {
      const record = await findClientById(id);
      console.log("[RedisAdapter.find] Client id:", id, "record:", record);
      if (!record) return undefined;
      return record as unknown as Record<string, unknown>;
    }

    const data = consumable.has(this.name)
      ? await redis.hgetall(this.key(id))
      : await redis.get(this.key(id));

    if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
      return undefined;
    }
    if (typeof data === "string") return JSON.parse(data);
    const { payload, ...rest } = data;
    return { ...rest, ...JSON.parse(payload) };
  }

  async findByUid(uid: string) {
    const id = await redis.get(uidKeyFor(uid));
    if (!id) return undefined;
    return this.find(id);
  }

  async findByUserCode(userCode: string) {
    const id = await redis.get(userCodeKeyFor(userCode));
    if (!id) return undefined;
    return this.find(id);
  }

  async destroy(id: string) {
    if (this.name === "Client") return;
    await redis.del(this.key(id));
  }

  async revokeByGrantId(grantId: string) {
    if (this.name === "Client") return;
    const multi = redis.multi();
    const tokens = await redis.lrange(grantKeyFor(grantId), 0, -1);
    tokens.forEach((token) => multi.del(token));
    multi.del(grantKeyFor(grantId));
    await multi.exec();
  }

  async consume(id: string) {
    if (this.name === "Client") return;
    await redis.hset(this.key(id), "consumed", Math.floor(Date.now() / 1000));
  }
}

export default RedisAdapter;

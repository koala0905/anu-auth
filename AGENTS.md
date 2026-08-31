# AGENTS.md

## 專案概述

OIDC Provider 微服務（`anu-auth`）。TypeScript + Express v5，**ESM** 模組系統。屬於 `anu-network` Docker 生態系 — Traefik 將 `auth.localhost` 路由到此服務的 port 3000。

## 指令

- `npm run dev` — 透過 tsx watch 熱重載開發
- `npm run build` — 編譯 TypeScript 到 `dist/`（`tsc`）
- `npm start` — 執行編譯後的 `dist/index.js`

## 開發環境

- Dev container: `mcr.microsoft.com/devcontainers/typescript-node:5-24-trixie`（Node 24，TypeScript 7 全域安裝）
- `tsconfig.json` 和 `src/index.ts` 需要先建立，build/dev 才能運作
- Prettier 透過 VS Code extension 設定（devcontainer）

## 約定

- **ESM**（`"type": "module"` in package.json）— 使用 `import`/`export`，source 內可用 `import.meta.dirname`（Node 24）。注意：不能用 `__dirname`（ESM scope 不存在）
- **Express 5**（不是 v4）— 注意 v5 API 差異
- 使用 `oidc-provider` 函式庫實作 OIDC 協議，不需要手動簽 JWT 或產生金鑰對
- 已安裝的依賴：express, ejs, bcrypt, oidc-provider, ioredis, pg, dotenv, cookie-parser, cors, helmet, express-rate-limit

## 架構：Auth Server 自己 render 登入/consent

`anu-auth` 自己 render 登入與 consent 頁面（`ejs` 模板），不再跳去獨立的 account app。互動邏輯集中在 `src/routes/interaction/`。

### OIDC 流程

```
Client → GET /authorize?client_id=xxx&scope=openid+profile+email&...
  ↓
oidc-provider 檢查是否需登入/consent
  ↓
需要 → redirect 到 auth.localhost/interaction/:uid
  ↓
GET /interaction/:uid → interactionDetails
  ↓
prompt=login  → render login.ejs
prompt=consent → render consent.ejs
  ↓
POST /interaction/:uid（表單提交）
  ↓
login  → loginSubmit：bcrypt 驗證 → interactionFinished({ login: { accountId } })
consent → consentSubmit：建立 Grant → interactionFinished({ login, consent: { grantId } })
  ↓
oidc-provider 驗證 → redirect 回 Client 的 redirect_uri，附上 code
```

### 互動端點

oidc-provider 自動處理的端點：
- `/.well-known/openid-configuration`
- `/.well-known/jwks.json`
- `/authorize`
- `/token`
- `/userinfo`
- `/logout`

自己實作的互動端點（`src/routes/interaction/index.ts`）：
- `GET /interaction/:uid` — 依 `details.prompt.name` 分派 login/consent render
- `POST /interaction/:uid` — 依 prompt 分派 loginSubmit/consentSubmit

### 互動處理邏輯

`interactionDetails` 從 cookie 找回互動 session，`details.prompt.name` 決定是 login 或 consent：

**login**（`src/routes/interaction/login.ts`）：
- `loginSubmit` 用 `findUserByUsernameWithCredentials` 找使用者 + `bcrypt.compare` 驗證密碼
- 成功 → `provider.interactionFinished({ login: { accountId: user.id }, consent: {} })`

**consent**（`src/routes/interaction/consent.ts`）：
- GET 用 `findClientById` / `findUserById` 帶 `clientName`、`userEmail` 進模板，`details.prompt.details.missingOIDCScope` 帶進模板動態顯示 scope
- `consentSubmit`：建立 `new provider.Grant({ accountId, clientId })` → `grant.addOIDCScope(missingOIDCScope)` → `grant.save()` → `interactionFinished({ login, consent: { grantId } })`
- deny → `interactionFinished({ error: "access_denied" })`

注意：`addOIDCScope` ／`addOIDCClaims` 接受 `string | string[] | Set<string>`，**不要 spread**（不是 rest parameter）。

### 服務啟動依賴

`src/index.ts` 啟動前會連線測試 PostgreSQL 與 Redis，任一連不上就 `process.exit(1)`：
- PostgreSQL 連線（pool query `SELECT 1`）
- Redis ping（`ioredis`）

oidc 資料（session/code/token/grant）存 Redis（`src/adapters/redis.ts`），client 資訊透過 adapter 從 PostgreSQL 讀（`findClientById`）。

### 環境變數（見 `.env.example`）

- `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_HOST` / `DB_PORT` — PostgreSQL
- `REDIS_URL` — Redis（例如 `redis://redis:6379`）
- `COOKIE_SECRET` — oidc-provider 加密 session cookie 的金鑰（逗號分隔，至少一個）
- `ISSUER_URL` — issuer 網址（例如 `http://auth.localhost`）
- `PORT` — 服務 port（預設 `3000`）

### 正式環境注意事項

- 外部通訊（Client → Auth server）：Traefik 處理 TLS 終止
- `/interaction/:uid` 的 GET/POST 路由註冊在 `provider.callback()` **之前**（`src/index.ts`），確保自家互動處理優先於 oidc 內建

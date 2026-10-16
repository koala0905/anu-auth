anu-auth 自訂互動規格（草案）
目標：登入頁 + consent 頁由 anu-auth 自己 render，取代 oidc-provider 內建 dev 登入頁；暫不跳去 account app。
流程
瀏覽器 /authorize
→ oidc 偵測需登入 → redirect auth.localhost/login/:uid
→ 填 username + password → bcryptjs 驗證
→ 需 consent → redirect auth.localhost/consent/:uid
→ 顯示 scopes + client 資料 → 同意
→ 回 /authorize → redirect 回 client 帶 code
檔案改動

1. src/db/users.ts — 加 findUserByUsernameWithCredentials（select password_hash + id）
2. src/provider.ts — 關 devInteractions、設 interactions.url = /login/:uid
3. src/index.ts — 加 GET/POST /login/:uid、GET/POST /consent/:uid（取代舊 /confirm）
4. 新增依賴：bcryptjs
   技術關鍵

- interactionDetails(req,res) 用 cookie 找回互動 session
- 登入成功 → interactionFinished({ login: { accountId: user.id }, consent: {} })
- consent 同意 → 建 grant → interactionFinished({ login, consent: { grantId } })
  在我把這份變正式執行計畫前，有幾點想先跟你確認，避免做完才發現方向不對：

1. 你想不想先看更詳細的見文件/一步一步執行的請求，還是看完這份規格就開工？
2. 你之前的 GET /interaction/:uid/confirm 是為 account app 設計的 — 既然轉向 auth app 內建登入，這路由要刪掉改用 /login /consent，可以嗎？還是你想保留 /confirm 當主入口？

第一階段：login（登入）
瀏覽器 → GET /authorize?client_id=...&scope=openid+profile
↓ oidc-provider 檢查 policy
↓ login 未滿足（session 沒帳號）
↓ 建立互動 session，uid=abc123
↓ redirect → 你的 /interaction/abc123 ← 你設定 url 的結果
↓
你的 GET /interaction/abc123：
↓ 呼叫 provider.interactionDetails(req,res) ← 從 cookie 找回這個互動 session
↓ 拿到 details.prompt.name === "login"
↓ render 登入表單
↓
使用者填 username + password → POST /interaction/abc123
↓
你的 POST handler：
↓ interactionDetails 又得到 prompt=login
↓ 你驗證密碼（bcrypt）對不對
↓ 對 → 呼叫 interactionFinished(req,res,{
↓ login: { accountId: user.id } ← 告訴 oidc："登入的使用者是 user.id"
↓ })
↓ interactionFinished 內部：把 login 結果存進互動 session，
↓ 然後 303 redirect 回「resume」路由（/interaction/:uid/resume 那類）
↓
resume → oidc 把 login.accountId 寫進 session（session 現在有 accountId = 已登入）
↓ oidc 再次檢查 policy
↓ login 已滿足 ✓ ，但 consent 可能還未滿足
↓ 建立【新的】互動 session，uid=xyz789（注意！不同 uid）
↓ redirect → 你的 /interaction/xyz789
第二階段：consent（授權同意）
你的 GET /interaction/xyz789：
↓ interactionDetails → details.prompt.name === "consent"
↓ 這次不是登入，而是授權確認
↓ 從 details.params.client_id 查 client、從 details.prompt.details.missingOIDCScope
↓ 得知 client 要求哪些 scope
↓ render「同意畫面」（顯示 scopes + client 資料）
↓
使用者點 Allow → POST /interaction/xyz789
↓
你的 POST handler：
↓ interactionDetails → prompt=consent
↓ 建立 grant（記錄「這個 user 授權了這個 client 這些 scope」）
↓ const grant = new provider.Grant({ accountId, clientId })
↓ grant.addOIDCScope(...) / grant.addOIDCClaims(...)
↓ const grantId = await grant.save()
↓ 呼叫 interactionFinished(req,res,{ consent: { grantId } })
↓ 303 redirect 回 resume
↓
resume → oidc 檢查：login ✓ + consent ✓ 都滿足
↓ 結束授權，產生 authorization code
↓ redirect 回 client 的 redirect_uri，帶上 ?code=...
對照上面就懂了先前那段 code 每行在幹嘛：
程式行 對應流程
provider.interactionDetails(req,res) 從 cookie 找回這個互動 session，看它是 login 還是 consent
details.prompt.name === "login" 第一階段，render 登入表單
bcrypt.compare(...) 你負責的正確驗證
interactionFinished({ login: { accountId } }) 回報「登入完成，此 user」
details.prompt.name === "consent" 第二階段，render 同意畫面
new provider.Grant(...) + interactionFinished({ consent: { grantId } }) 回報「此 user 同意了這些 scope」

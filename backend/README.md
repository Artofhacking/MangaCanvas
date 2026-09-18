# MangaCanvas Backend

按前端 `BACKEND_API_SPEC_V2.md` 逆向实现的业务后端。默认 SQLite，端口 `8088`，前缀 `/api/v1`。

## 启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8088
```

前端开发环境已代理 `/api` → `http://localhost:8080`。保持：

```
VITE_MOCK_MODE=false
VITE_APP_API_BASE_URL=/api/v1
```

## 默认账号

| 邮箱 | 密码 | 角色 |
|------|------|------|
| `superadmin@artofhacking.com` | `123456` | 超级管理员 |

与登录页预填账号一致。新注册用户会自动加入默认组织 `MangaCanvas Studio`。

## 覆盖范围

文档里的 66 个业务接口均已实现，包括：

- Auth / Organizations / Users
- Projects / Members / Duplicate
- Characters / Scenes / Objects / Episodes / Relations
- Canvas workflows + members
- Assets / Upload（本地预签名 PUT）
- Credits / Billing quotas
- `POST /api/v1/ai/images/generations`（无网关密钥时返回本地占位图）

飞书登录：配置 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 后启用。企业自建应用 **MangaCanvas**（`cli_aa21391b3ef89bef`）已创建，重定向 URL：

- `http://localhost:5174/api/v1/auth/oauth/feishu/callback`
- `http://127.0.0.1:5174/api/v1/auth/oauth/feishu/callback`
- `http://47.104.138.144:18999/api/v1/auth/oauth/feishu/callback`

如需额外前端域名，设置 `FEISHU_REDIRECT_ORIGINS`（逗号分隔）并在飞书后台补登记。登录页会显示「使用飞书登录」。未配置时该按钮不出现。全员可用前需在开放平台提交应用版本并完成企业审核。

配置 `DASHSCOPE_API_KEY` 后，图像生成会转发到兼容网关。

视频：

- nexcor HappyHorse：`OPENAI_API_KEY` / `OPENAI_BASE_URL`
- 百度网关 Seedance：`BAIDU_API_KEY` / `BAIDU_BASE_URL`（默认关闭，`BAIDU_ENABLED=1` 才开放）
- MiniMax H3：`MINIMAX_API_KEY` / `MINIMAX_BASE_URL`（默认关闭，`MINIMAX_ENABLED=1` 才开放）
- Vidu Q3：`VIDU_API_KEY` / `VIDU_BASE_URL`（默认关闭，`VIDU_ENABLED=1` 才开放）
- 百度云 VOD 密钥：`BAIDU_VOD_AK` / `BAIDU_VOD_SK`（已配置，播放域名未接）

密钥只写 `backend/.env`，不要提交。网关说明见 `docs/ai-providers.md`。

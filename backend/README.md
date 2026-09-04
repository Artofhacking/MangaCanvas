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

OAuth 路由存在，但未接真实 Google/GitHub，会返回业务码 `1001`。

配置 `DASHSCOPE_API_KEY` 后，图像生成会转发到兼容网关。

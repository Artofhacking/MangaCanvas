# 已接入且未禁用云商：官方文档与价格参数

快照日期：**2026-09-21**。刊例以厂商/开放平台官网为准；nexcor 本身没有公开价目，积分按**厂商刊例**换算，发票高于刊例时由超管 `PUT /credits/prices/{id}` 覆盖。密钥只写 `backend/.env`，不要提交。

相关文档：

- 网关开关与探测约定：[`docs/ai-providers.md`](./ai-providers.md)
- 积分钱包与 seed 规则：[`docs/credits-system-design.md`](./credits-system-design.md)
- 价目种子：`backend/app/seed.py` 的 `PRICE_RULES`

## 范围

「已接入且未禁用」= 代码里有完整调用路径，且**没有** `*_ENABLED` 默认关闭开关。

| 云商 | 判定 | 启用条件 | 本仓库用途 |
|------|------|----------|------------|
| **nexcor** | 已接入、无禁用开关 | `OPENAI_API_KEY` 非空 | 图像（GPT / 万相 2.7 / 千问生图）、HappyHorse 视频、`qwen-plus` 润色 |
| **阿里云百炼 DashScope** | 已接入、无禁用开关 | `DASHSCOPE_API_KEY` 非空 | `wan2.6-*` 图像直连；无 xAI / nexcor 时的聊天回退 |
| **xAI** | 已接入、无禁用开关 | `XAI_API_KEY` 非空 | `grok-4.5` 润色 / 剧本解析（优先于 qwen） |
| **飞书开放平台** | 已接入、无禁用开关 | `FEISHU_APP_ID` + `FEISHU_APP_SECRET` | OAuth 登录，**不计生成费** |

百度云 Seedance、MiniMax H3、Vidu Q3 有 `BAIDU_ENABLED` / `MINIMAX_ENABLED` / `VIDU_ENABLED`，默认 `0`，**不在本文主表**（见文末附录）。百度云 VOD 只有密钥、生成链路未切过去，也不算启用。

密钥未配 ≠ 禁用：DashScope / xAI 配上 Key 即出现在 `/ai/models`。现网是否已填 Key 以生产机 `.env` 为准，本文不记录密钥。

## 积分换算（产品规则）

| 项 | 规则 |
|----|------|
| 面值 | **1 积分 = ¥0.01**（内部钱包，用户不能兑法币） |
| 美元刊例 | **USD × 7.20 = CNY**（目录快照汇率，不是实时中间价）→ **1 USD = 720 积分** |
| 取整 | 一律 `ceil`，最低 1 积分 |
| 图像 | 按张（`unit=image`）× `n` |
| 视频 | 按秒（`unit=video_second`）× 解析后时长（HappyHorse 仅 5 / 10 / 15） |
| 文本 | 按次（`chat_request` / `script_parse`），不按真实 token 对账 |
| 无公开网关价 | 行标 **needs invoice**，给偏高占位，首张发票后 PUT |

公式：人民币刊例 `ceil(¥ / 0.01)`；美元刊例 `ceil(USD × 720)`。

---

## 1. nexcor（OpenAI 兼容网关）

现网主路径。环境变量名沿用 OpenAI SDK 习惯，**实际打的是 nexcor，不是 api.openai.com**。

### 接入参数

| 项 | 值 |
|----|----|
| 环境变量 | `OPENAI_API_KEY`、`OPENAI_BASE_URL` |
| 默认 Base URL | `https://cc.nexcor.ai/v1` |
| 鉴权 | `Authorization: Bearer <OPENAI_API_KEY>` |
| 探测 | `GET /v1/models`；图像/视频禁止用会真实建任务的 POST 做探测 |

nexcor **没有公开价目页**。积分按下列厂商官网刊例；nexcor 转售加价以发票为准。

### 调用约定（本仓库）

| 能力 | HTTP | 路径 | 关键参数 |
|------|------|------|----------|
| 文生图 | POST | `/images/generations` | `model`, `prompt`, `n`（1–4）, `size`, `quality` |
| 图生图 / 编辑 | POST | `/images/edits` | multipart：`image` + `model`/`prompt`/`n`/`size`/`quality` |
| 视频提交 | POST | `/video/generations` | `model`, `prompt`, `duration`, `size`, `audio=true`；图生带 `img_url` / `images` |
| 视频查询 | GET | `/videos/{id}`，失败再试 `/video/generations/{id}` | 轮询最多 110×5s |
| 聊天 | POST | `/chat/completions` | `model=qwen-plus`（无 xAI Key 时） |

实现：`backend/app/ai_media.py` 的 `openai_image_generate` / `openai_video_generate` / `llm_complete`。

### 1.1 GPT Image（厂商：OpenAI）

官方文档：

- 价格：<https://developers.openai.com/api/docs/pricing>
- 图像生成：<https://developers.openai.com/api/docs/guides/image-generation>
- 图像 API：<https://developers.openai.com/api/reference/resources/images>

Token 刊例（每百万，Standard，2026-09-21）：

| 模型 | 文本输入 | 文本缓存 | 图像输入 | 图像缓存 | 图像输出 |
|------|----------|----------|----------|----------|----------|
| `gpt-image-2` | $5.00 | $1.25 | $8.00 | $2.00 | $30.00 |
| `gpt-image-2.5-flare` | $5.00 | $1.25 | $8.00 | $2.00 | $30.00 |
| `gpt-image-2.5-sunburst` | $5.00 | $1.25 | $8.00 | $2.00 | $30.00 |

按张估算用官方计算器的 **1024×1024 输出档**（v1 画布比例不加价，与默认 size 一致）：

| quality | 1024×1024 刊例 | 积分 / 张 | 换算 |
|---------|----------------|-----------|------|
| `low` | $0.006 | **5** | ceil(0.006×720)=5 |
| `medium` | $0.053 | **39** | ceil(0.053×720)=39 |
| `high` | $0.211 | **152** | ceil(0.211×720)=152 |

Flare / Sunburst 与 `gpt-image-2` **同档 token 价**。官方计算器尚未单独给出 2.5 每张 token 数，seed 暂用 2.0 的 1024² 三档。

本仓库质量映射（`openai_quality`）：缺省 / `standard` → `medium`；`hd` → `high`。尺寸（`openai_size`）对合法 `WxH`（宽高 ÷16、比例 1:3–3:1、不超过约 3840×2160）原样透传，不再压成旧的三档。

### 1.2 万相 / 千问生图（厂商：阿里云百炼，经 nexcor 转售）

nexcor 目录 id：`wan2.7-image`、`wan2.7-image-pro`、`qwen-image-2.0`、`qwen-image-2.0-pro`。刊例用百炼中国内地（华北 2 / 北京），见第 2 节。无 DashScope Key 时，`wan2.6-*` 会 rewrite 成 `wan2.7-image` 再走 nexcor。

### 1.3 HappyHorse 1.1 视频（厂商：阿里云百炼，经 nexcor 转售）

nexcor 未公布秒价。**厂商公开价在百炼**（华北 2 / 北京，仅输出、按成功秒数）：

| 模型 | 480P | 720P | 1080P | 免费额度（北京，90 天） |
|------|------|------|-------|-------------------------|
| `happyhorse-1.1-t2v` / `i2v` / `r2v` | ¥0.45 / 秒 | ¥0.90 / 秒 | ¥1.20 / 秒 | 10 秒 |

官方文档：

- 百炼价格总表：<https://help.aliyun.com/zh/model-studio/model-pricing>
- 图生视频模型卡：<https://help.aliyun.com/zh/model-studio/happyhorse-1-1-i2v>

按刊例换算应为 **45 / 90 / 120 积分每秒**。当前 `PRICE_RULES` 仍是 **120 / 200**（720p / 1080p），产品当时按「nexcor 无公开价」给了偏高占位（needs invoice）。**未改 seed**：发票对上百炼后，超管 PUT 下调；若 nexcor 账单更高则维持或上调。画布不用 480P。

本仓库视频参数：

| 参数 | 取值 |
|------|------|
| duration | 仅 **5 / 10 / 15**，其它 1001（`require_happyhorse_duration`） |
| 分辨率计费键 | `720p` / `1080p` |
| 有声 | `audio: true` |
| 多参考图 | ≥2 张或 id 含 `r2v` → `happyhorse-1.1-r2v`（最多 3 张） |
| 模板特效 / kf2v | 按 `happyhorse-1.1-i2v` 计价 |

5 秒估价：seed 720p **600** / 1080p **1000**；若改用百炼刊例则 720p 450 / 1080p 600。

---

## 2. 阿里云百炼（DashScope）

无独立 `DASHSCOPE_ENABLED`。Key 为空时 `wan2.6-*` 不进 `/ai/models`，聊天回退到 nexcor（若有 OpenAI Key）。

### 接入参数

| 项 | 值 |
|----|----|
| 环境变量 | `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` |
| 兼容模式（聊天） | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 原生异步（生图） | 代码写死 `https://dashscope.aliyuncs.com/api/v1` |
| 鉴权 | `Authorization: Bearer <DASHSCOPE_API_KEY>` |
| 异步头 | `X-DashScope-Async: enable` |
| 地域 | 刊例用 **华北 2（北京）**；Key 必须与 endpoint 同地域 |

官方文档：

- 模型价格：<https://help.aliyun.com/zh/model-studio/model-pricing>
- 模型列表：<https://help.aliyun.com/zh/model-studio/models>
- OpenAI 兼容：<https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope>
- 获取 API Key：<https://help.aliyun.com/zh/model-studio/get-api-key>
- 万相 2.6 图像：<https://help.aliyun.com/zh/model-studio/wan2-6-image>
- 千问生图 2.0：<https://help.aliyun.com/zh/model-studio/qwen-image-2-0>
- 万相图像 API：<https://www.alibabacloud.com/help/zh/model-studio/wan-image-generation-api-reference>

### 调用约定（本仓库）

| 能力 | 路径 | 说明 |
|------|------|------|
| 万相 2.6 生图 | `POST /api/v1/services/aigc/image-generation/generation` | `wan*` 且已配 DashScope Key 时优先于 nexcor；`n` 必须为 1 |
| 任务查询 | `GET /api/v1/tasks/{task_id}` | 最多 120×1.5s |
| 聊天 | `POST {DASHSCOPE_BASE_URL}/chat/completions` | 无 xAI、无 nexcor 时用 |

### 图像刊例（华北 2 / 北京，按成功张数，输入图不计费）

| model_id | 刊例 | 积分 / 张 | 免费额度（90 天） |
|----------|------|-----------|-------------------|
| `wan2.7-image` | ¥0.20 / 张 | **20** | 50 张 |
| `wan2.7-image-pro` | ¥0.50 / 张 | **50** | 50 张 |
| `qwen-image-2.0` | ¥0.20 / 张 | **20** | 100 张 |
| `qwen-image-2.0-pro` | ¥0.50 / 张 | **50** | 100 张 |
| `wan2.6-t2i` | ¥0.20 / 张 | **20** | 50 张 |
| `wan2.6-image` | ¥0.20 / 张 | **20** | 50 张 |

新加坡国际站更贵（例如 `qwen-image-2.0` ¥0.256873 / 张）。本仓库按北京原价。费用 = 单价 × 成功张数；失败不扣厂商费。

### 文本刊例：`qwen-plus`（华北 2 / 北京）

当前能力等同 `qwen-plus-2025-12-01`。非思考模式：

| 输入 Token 档 | 输入 / 百万 | 输出 / 百万 |
|---------------|-------------|-------------|
| 0 &lt; Token ≤ 128K | ¥0.8 | ¥2 |
| 128K &lt; Token ≤ 256K | ¥2.4 | ¥20 |
| 256K &lt; Token ≤ 1M | ¥4.8 | ¥48 |

思考模式输出更贵（≤128K 为 ¥8 / 百万）。v1 按次、按 ≤128K 非思考估算：

| unit | 典型用量 | 刊例成本 | 积分 |
|------|----------|----------|------|
| `chat_request` | 500 in + 200 out | ¥0.0008 | **1** |
| `script_parse` | 30k in + 8k out（`MAX_LLM_CHARS≈40_000`） | ¥0.040 | **4** |

启发式剧本拆解不 reserve、不扣积分。

---

## 3. xAI

无 `XAI_ENABLED`。有 Key 时 `billed_chat_model()` **恒为** `grok-4.5`，覆盖 body 里的 qwen。

### 接入参数

| 项 | 值 |
|----|----|
| 环境变量 | `XAI_API_KEY`、`XAI_BASE_URL` |
| 默认 Base URL | `https://api.x.ai/v1` |
| 鉴权 | `Authorization: Bearer <XAI_API_KEY>` |
| 本仓库调用 | `POST /chat/completions`，`model=grok-4.5` |

官方文档：

- 模型卡：<https://docs.x.ai/developers/models/grok-4.5>
- 模型与价格总表：<https://docs.x.ai/developers/models.md>
- API 概览：<https://docs.x.ai/docs/overview>

### 刊例：`grok-4.5`

上下文 500K。prompt 达到 200K 后**整单**按长上下文价。

| | &lt; 200K prompt / 百万 | ≥ 200K prompt / 百万 |
|--|-------------------------|----------------------|
| 输入 | $2.00 | $4.00 |
| 缓存输入 | $0.30 | $0.60 |
| 输出 | $6.00 | $12.00 |

限流（官方）：150 RPS，50M TPM。地域：`us-east-1`、`us-west-2`。

v1 按次（短上下文）：

| unit | 典型用量 | 美元 | ×7.20 | 积分 |
|------|----------|------|-------|------|
| `chat_request` | 500 in + 200 out | $0.0022 | ¥0.01584 | **2** |
| `script_parse` | 30k in + 8k out | $0.108 | ¥0.7776 | **78** |

本仓库不用 xAI 的 Imagine 图像/视频（`grok-imagine-*`）。

聊天路由优先级：`XAI_API_KEY` → grok-4.5；否则 `OPENAI_API_KEY` 或 `DASHSCOPE_API_KEY` → qwen-plus。

---

## 4. 飞书开放平台（登录）

不计生成费，无积分价目。登录已有身份或邮箱匹配用户；注册关闭时**不建新号**（`fail(1003, 暂不开放注册)`）。飞书登录不加积分、无欢迎包。

### 接入参数

| 项 | 值 |
|----|----|
| 环境变量 | `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_REDIRECT_ORIGINS` |
| 授权页 | `https://accounts.feishu.cn/open-apis/authen/v1/authorize` |
| 换 token | `POST https://open.feishu.cn/open-apis/authen/v2/oauth/token` |
| 用户信息 | `GET https://open.feishu.cn/open-apis/authen/v1/user_info` |
| 本仓库回调 | `/api/v1/auth/oauth/feishu/callback` |

必须在飞书后台「安全设置」登记完整回调 URL（含 origin + path）。默认 origin 含 `localhost:5174` / `4173` 与 `http://47.104.138.144:18999`。

官方文档：

- 登录流程：<https://open.feishu.cn/document/sso/web-application-sso/login-overview>
- 网页接入：<https://open.feishu.cn/document/sso/web-application-end-user-consent/guide>
- 获取授权码：<https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code>
- 获取 user_access_token：<https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token>
- 开发者后台：<https://open.feishu.cn/app>

飞书开放平台对 OAuth 本身不按次向应用收费；企业版席位/应用审核以飞书商务合同为准，与生成积分无关。

---

## 本仓库 seed 对照（启用渠道）

与 `PRICE_RULES` 一致。`seed_price_rules()` **只 insert-if-missing**，不会把超管改过的价打回刊例。

| model_id | unit | quality | resolution | credits_per_unit | 出处 |
|----------|------|---------|------------|------------------|------|
| `gpt-image-2` / `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` | image | low | | 5 | OpenAI 1024² |
| 同上 | image | medium | | 39 | 同上 |
| 同上 | image | high | | 152 | 同上 |
| `wan2.7-image` / `qwen-image-2.0` / `wan2.6-t2i` / `wan2.6-image` | image | | | 20 | 百炼北京 |
| `wan2.7-image-pro` / `qwen-image-2.0-pro` | image | | | 50 | 百炼北京 |
| `happyhorse-1.1-t2v` / `i2v` / `r2v` | video_second | | 720p | **120** | needs invoice（百炼刊例=90） |
| 同上 | video_second | | 1080p | **200** | needs invoice（百炼刊例=120） |
| `qwen-plus` | chat_request | | | 1 | 百炼 token × 典型用量 |
| `qwen-plus` | script_parse | | | 4 | 同上 |
| `grok-4.5` | chat_request | | | 2 | xAI token × 典型用量 |
| `grok-4.5` | script_parse | | | 78 | 同上 |

---

## 附录：已接入但默认禁用

代码与 Key 可留着，画布不展示，`/ai/models` 不返回，生成接口 503。重新打开：对应 `*_ENABLED=1`。网关细节见 [`docs/ai-providers.md`](./ai-providers.md)。价目行已预置，避免一开渠道无法扣费。

| 渠道 | 开关 | 官方价格（检索备查，非启用） |
|------|------|------------------------------|
| 百度智能云 AI 网关 · Seedance | `BAIDU_ENABLED` | 火山方舟 token 刊例折成秒：<https://www.volcengine.com/docs/82379/2191775> |
| MiniMax Hailuo H3 | `MINIMAX_ENABLED` | <https://platform.minimax.cn/docs/guides/pricing-paygo> |
| Vidu Q3 | `VIDU_ENABLED` | <https://platform.vidu.cn/docs/pricing.md>（1 Vidu 积分 = ¥0.03125） |

百度云 VOD（`BAIDU_VOD_AK` / `SK`）只做媒资预留，生成结果仍落本机 `uploads/`。
)

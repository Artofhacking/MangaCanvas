# AI 模型网关

密钥只放本机和生产机的 `backend/.env`，不要写入 git、文档或前端。

已接入且未禁用云商的官方文档、调用参数和刊例换算见 [`docs/vendor-pricing.md`](./vendor-pricing.md)。

## nexcor（图像 / HappyHorse 视频 / 润色）

| 环境变量 | 值 |
| --- | --- |
| `OPENAI_BASE_URL` | `https://cc.nexcor.ai/v1` |
| `OPENAI_API_KEY` | 只写 `.env` |

图像：`gpt-image-2`、`wan2.7-image` / `-pro`、`qwen-image-2.0` / `-pro`。视频：`happyhorse-1.1-t2v` / `happyhorse-1.1-i2v` / `happyhorse-1.1-r2v`（多参考图，原生有声）。若 nexcor `GET /v1/models` 列出任何 `*seedance*` id，`/ai/models` 会展示并走 nexcor `POST /video/generations`（**禁止 POST 探测 Seedance**）。润色：`qwen-plus`。`VIDU_ENABLED=0` 时多图生视频不再改走 Vidu。

## 已禁用渠道

百度云 Seedance、MiniMax H3、Vidu Q3 默认关闭。百度开关关闭时，Seedance **仍可**因 nexcor `/models` 列出而出现；未列出则不展示、也不伪造。MiniMax / Vidu 在对应开关关闭时不进 `/ai/models`，生成 503。

| 渠道 | 开关（默认 0） | 重新启用 |
| --- | --- | --- |
| 百度云 Seedance | `BAIDU_ENABLED` | `BAIDU_ENABLED=1` |
| MiniMax H3 | `MINIMAX_ENABLED` | `MINIMAX_ENABLED=1` |
| Vidu Q3 | `VIDU_ENABLED` | `VIDU_ENABLED=1` |

接入代码仍在，Key 可留在 `.env`。前端对应模型需把 `enabled` 改回 `true`。

## 百度智能云 AI 网关（Seedance 视频）

| 环境变量 | 值 |
| --- | --- |
| `BAIDU_BASE_URL` | `https://ai-gateway.baidubce.com`（不要带 `/v1`；视频走 `/api/v3/...`） |
| `BAIDU_API_KEY` | 只写 `.env` |
| `BAIDU_ENABLED` | 默认 `0` |

| 模型 id | 画布名称 | 最高分辨率 | 画布时长 |
| --- | --- | --- | --- |
| `doubao-seedance-2-0-260128` | Seedance 2.0 | 1080p | 5 / 10 秒（接口 4–15） |
| `doubao-seedance-2-0-fast-260128` | Seedance 2.0 Fast | 720p | 5 / 10 秒 |
| `doubao-seedance-2-0-mini-260615` | Seedance 2.0 Mini | 720p | 5 / 10 秒 |
| `doubao-seedance-2-5-260628` | Seedance 2.5 | 1080p | 5 / 10 / 15 秒（接口最长 30） |

调用方式（Ark 兼容，豆包原生 `content` 数组）：

- 创建：`POST /api/v3/contents/generations/tasks`
- 查询：`GET /api/v3/contents/generations/tasks/{id}`，成功时视频在 `content.video_url`
- 可用探测：`GET /v1/models` 与目录做 id 交集。**禁止用 POST 探测**（会真实建任务并计费）

四个模型都是文生 / 图生双模式：文本必填，首帧可选（`content[].role = first_frame`）。`resolve_video_model` 必须保留 Seedance 原 id，不能映射到 HappyHorse。

## MiniMax（Hailuo H3 视频）

| 环境变量 | 值 |
| --- | --- |
| `MINIMAX_BASE_URL` | `https://api.minimax.cn`（国内；不要用 `.io`） |
| `MINIMAX_API_KEY` | 只写 `.env` |
| `MINIMAX_ENABLED` | 默认 `0` |

| 模型 id | 画布名称 | 分辨率 | 画布时长 |
| --- | --- | --- | --- |
| `MiniMax-H3` | MiniMax H3 | 画布 720P→`768P`，1080P→`2K` | 5 / 10 / 15 秒（接口 4–15） |
| `MiniMax-H3-Max` | MiniMax H3 Max | 仅 `768P`（不支持 2K） | 5 / 10 / 15 秒 |

- 创建：`POST /v2/video_generation`（`content` 数组）
- 查询：`GET /v2/query/video_generation/{task_id}`，成功时视频在 `task.content.url`
- 可用探测：`GET /v1/models` 鉴权成功即可。**禁止 POST 探测**

文生 `ratio` 必填且不能 `adaptive`；图生（首帧）`ratio` 固定 `adaptive`。

## Vidu（Q3 视频）

| 环境变量 | 值 |
| --- | --- |
| `VIDU_BASE_URL` | `https://api.vidu.cn`（国内；鉴权是 `Authorization: Token …` 不是 Bearer） |
| `VIDU_API_KEY` | 只写 `.env` |
| `VIDU_ENABLED` | 默认 `0` |

| 模型 id | 画布名称 | 分辨率 | 画布时长 |
| --- | --- | --- | --- |
| `viduq3-pro` | Vidu Q3 Pro | 720p / 1080p | 5 / 10 / 15 秒（接口 1–16） |
| `viduq3-turbo` | Vidu Q3 Turbo | 720p / 1080p | 5 / 10 / 15 秒 |

- 文生：`POST /ent/v2/text2video`
- 图生：`POST /ent/v2/img2video`
- 首尾帧：`POST /ent/v2/start-end2video`
- 查询：`GET /ent/v2/tasks/{id}/creations`，成功时视频在 `creations[0].url`（约 24 小时有效，后端会转存）
- 可用探测：`GET /ent/v2/credits`。**禁止 POST 探测**

## 百度云 VOD（媒资存储，尚未接入播放）

| 环境变量 | 说明 |
| --- | --- |
| `BAIDU_VOD_AK` | Access Key ID（`ALTAK-…`） |
| `BAIDU_VOD_SK` | Secret Access Key |
| `BAIDU_VOD_ENDPOINT` | 默认 `https://vod.baidubce.com` |

当前生成结果仍转存到本机 `uploads/`。VOD 需要播放域名 / 空间后才能替换 CDN 地址，密钥已入库但生成链路未改走 VOD。

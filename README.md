# R2Gate

[![CI](https://github.com/Fiatnorm/R2Gate/actions/workflows/ci.yml/badge.svg)](https://github.com/Fiatnorm/R2Gate/actions/workflows/ci.yml)

R2Gate 是一个精简的 Cloudflare R2 文件读取鉴权与上传工具：Worker / Pages 负责读取和浏览，Python 脚本通过 R2 S3 Compatible API 创建或覆盖对象。项目不包含登录、JWT、数据库、KV、D1、后台、Presigned URL、角色或多用户系统。

## 项目文件

- `worker.mjs`：Cloudflare Worker 入口。
- `pages-dist/_worker.js`：Pages Direct Upload 入口，与 `worker.mjs` 完全一致。
- `upload_r2.py`：R2 S3 API 上传脚本。
- `wrangler.toml`：Worker 示例配置。
- `config.example.json`：不含真实凭据的上传配置示例。
- `tests/`：Worker 与上传脚本回归测试。
- `LICENSE`：MIT License。

## 运行时配置

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `BUCKET` | 是 | R2 Binding，变量名固定为 `BUCKET`。 |
| `ACCESS_KEYS` | 是 | Plaintext JSON 对象；键为 Object Key，值为访问密钥。使用 `{}` 表示全部公开。 |
| `BROWSE_UUID` | 是 | Plaintext 高熵 Bearer 凭据，只用于查看全部文件。 |
| `DISPLAY_TIME_ZONE` | 否 | 有效 IANA 时区；默认 `Asia/Singapore`，页面显示 `GMT+8`。 |

根路径 `/` 会一次检查全部配置。全部有效时返回独立的 Material Design 3 深色 Status 页面；它与 Files 使用相同的 960px 内容宽度，并在桌面视口中纵向居中。页面显示：

```text
R2Gate is running successfully.
```

存在多个问题时，错误页会一次列出全部问题；Files 导航保持禁用。可能的提示包括：

- `R2 bucket binding is not configured`
- `ACCESS_KEYS variable is not configured`
- `Invalid ACCESS_KEYS configuration`
- `BROWSE_UUID variable is not configured`
- `Invalid DISPLAY_TIME_ZONE configuration`

## 部署

### Worker Dashboard

1. 创建 Worker，以 `worker.mjs` 完整内容替换示例代码。
2. 在 **Settings > Bindings** 添加 R2 Bucket，变量名填写 `BUCKET`。
3. 在 **Variables and Secrets** 添加 Plaintext 变量 `ACCESS_KEYS` 与 `BROWSE_UUID`。
4. 如需其他时区，添加 `DISPLAY_TIME_ZONE`，例如 `Europe/London`。
5. 重新部署并访问 Worker 地址。

### Wrangler

在 `wrangler.toml` 中配置真实 Bucket 和变量：

```toml
[vars]
ACCESS_KEYS = "{\"files/private.txt\":\"file-key\"}"
BROWSE_UUID = "your-random-uuid"
DISPLAY_TIME_ZONE = "Asia/Singapore"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"
```

然后运行：

```powershell
npx wrangler deploy
```

仓库中的 `BROWSE_UUID` 故意留空，部署前必须替换。

### Pages

Pages 只使用 `pages-dist`：

- Direct Upload：上传整个 `pages-dist` 目录或其 ZIP。
- Git 集成：Framework preset 选择 `None`，Build command 使用 `exit 0`，Build output directory 填写 `pages-dist`。

部署后在 Production 及所需 Preview 环境中添加与 Worker 相同的 `BUCKET`、`ACCESS_KEYS`、`BROWSE_UUID` 和可选 `DISPLAY_TIME_ZONE`，然后重新部署。不要把仓库根目录作为 Pages 上传目录。

## 文件访问

公开直链：

```text
https://example.com/files/public.txt
```

受保护直链：

```text
https://example.com/files/private.txt?key=file-key
```

Files 查询页链接：

```text
https://example.com/_files?object=files/private.txt&key=file-key
```

规则：

- URL 路径去掉开头 `/` 后即为 R2 Object Key。
- `ACCESS_KEYS` 中存在非空密钥时，必须且只能提交一个完全匹配的 `key` 参数；错误或重复参数返回 `403`，且不会读取 R2。
- 首个查询参数必须由 `?` 开始；`&` 只分隔后续参数。
- 未配置密钥的对象可直接读取。
- 不存在返回 `404`；R2 异常返回受控的 `500`。
- 仅支持 `GET` 和 `HEAD`，其他方法返回 `405`。
- 受保护响应使用 `private, no-store`、`no-referrer` 和 `nosniff`。

## Files 页面

公开文件：

```text
https://example.com/_files
```

全部文件：

```text
https://example.com/_files?uuid=your-browse-uuid
```

Files 与 Status 是两个独立页面，共用深色样式和 Status / Files / License / GitHub 导航。列表在内容区居中，桌面端按 Object Key / Access / Type / Size / Uploaded 紧凑排列，窄屏自动切换为卡片；点击整行即可打开对象。

- 公开页只显示无需密钥的对象；全部页标签显示 `Protected`。
- 类型来自同一次 R2 `list()` 返回的 HTTP metadata；缺失时显示 `application/octet-stream`，不会逐项调用 `get()` 或 `head()`。
- 每次最多查询 200 项，并依据 R2 的 `truncated` 与 cursor 分页。
- 全部文件的后续页使用 `BROWSE_UUID` 签发的 cursor 专用 HMAC-SHA-256 令牌，不重复暴露 UUID。
- 上传时间精确到秒。默认示例为 `25 Aug 2026 08:00:00`，表头显示 `Uploaded (GMT+8)`；自定义时区时显示对应 IANA 名称。
- 页面不显示 UUID 或密钥文本，但受保护对象链接本身包含 `key`，可在浏览器开发者工具中查看。
- 页面使用 `no-store`、`no-referrer`、`noindex`、CSP、禁止嵌入、HTML 转义和 URL 编码。
- `/_files` 只查询和读取，不提供上传、覆盖或删除功能。

## Python 上传

首次配置：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .\config.example.json .\config.json
```

编辑本地 `config.json` 后运行：

```powershell
.\.venv\Scripts\python.exe .\upload_r2.py
```

`LOCAL_FILE` 支持绝对路径或相对 `config.json` 的路径。上传脚本优先依据 R2 Object Key、其次依据本地文件名判断 `Content-Type`；常见跨平台类型使用固定映射，未知类型回退为 `application/octet-stream`。上传前用 `head_object` 区分 `CREATE` 与 `UPDATE`，实际传输由 boto3 `upload_file` 处理。

## 安全边界

- `config.json`、`.env*`、`.dev.vars*`、`.venv`、上传目标文件和真实密钥不得提交。
- R2 Bucket 应保持私有，避免通过 `r2.dev` 或 Bucket 自定义域绕过 Worker。
- `ACCESS_KEYS` 会出现在 URL、浏览器历史和可能的访问日志中，不要复用重要密码。
- `BROWSE_UUID` 是 Bearer 凭据，应使用高熵随机值且不得分享。轮换它不会撤销已取得的单文件链接；撤销单文件链接需轮换对应 `ACCESS_KEYS` 值。
- Worker / Pages 只读 R2；上传凭据只保存在本地 `config.json` 中，由 S3 API 脚本使用。

## 验证与持续集成

本地验证：

```powershell
node --check worker.mjs
node --test tests/test_worker.mjs
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v
```

还需解析 `config.example.json` 与 `wrangler.toml`，并确认 `worker.mjs` 和 `pages-dist/_worker.js` 完全一致。GitHub Actions 会执行这些检查，并阻止 `config.json`、本地环境文件和历史设计决策文件进入仓库；CI 不包含 Cloudflare 部署或 R2 写入。

## 开源协议

R2Gate 使用 [MIT License](LICENSE)。页面左侧 License 组件固定跳转到 `main` 分支的许可证原文。

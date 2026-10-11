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
| `ACCESS_KEYS` | 是 | Plaintext JSON 对象；键为 Object Key，值为非空访问密钥，单项最长 4096 字符。使用 `{}` 表示全部公开。 |
| `BROWSE_UUID` | 是 | Plaintext 高熵 Bearer 凭据，最长 128 字符，只用于查看全部文件。 |
| `DISPLAY_TIME_ZONE` | 否 | 有效 IANA 时区；默认 `Asia/Singapore`，页面显示 `GMT+8`。 |

根路径 `/` 会一次检查全部配置。全部有效时返回独立的 Material Design 3 Status 页面（支持亮色和暗色）；它与 Files 使用相同的 1120px 内容宽度，并在桌面视口中纵向居中。页面显示：

```text
R2Gate is running successfully.
```

存在多个问题时，错误页会一次列出全部问题；Files 导航保持禁用。可能的提示包括：

- `R2 bucket binding is not configured`
- `ACCESS_KEYS variable is not configured`
- `Invalid ACCESS_KEYS configuration`
- `BROWSE_UUID variable is not configured`
- `Invalid BROWSE_UUID configuration`
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

下载直链：

```text
https://example.com/files/public.txt?download=1
https://example.com/files/private.txt?key=file-key&download=1
```

Files 查询页链接：

```text
https://example.com/_files?object=files/private.txt&key=file-key
```

查询页下载链接：

```text
https://example.com/_files?object=files/private.txt&key=file-key&download=1
```

规则：

- URL 路径会按标准百分号编码解码，去掉开头 `/` 后即为 R2 Object Key；含特殊字符时优先使用 `/_files?object=...` 查询页链接。
- `ACCESS_KEYS` 的 Object Key 和访问密钥都必须非空且不超过 4096 字符；空密钥会作为无效配置拒绝，公开对象应直接从映射中省略。
- `ACCESS_KEYS` 中存在非空密钥时，必须且只能提交一个完全匹配的 `key` 参数；错误或重复参数返回 `403`，且不会读取 R2。
- 首个查询参数必须由 `?` 开始；`&` 只分隔后续参数。
- 直链或查询页链接携带且仅携带一个 `download=1` 时返回 `Content-Disposition: attachment`，下载文件名取 Object Key 的最后一个路径段；重复或其他值返回 `400`，且不会读取 R2。
- 未配置密钥的对象可直接读取。
- 不存在返回 `404`；R2 异常返回受控的 `500`。
- 支持 `GET`、`HEAD` 和用于 CORS 预检的 `OPTIONS`；`OPTIONS` 返回 `204` 且不读取 R2，其他方法返回 `405`。
- 受保护响应使用 `private, no-store`、`no-referrer` 和 `nosniff`。

## 跨域读取

R2Gate 的所有响应均返回：

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Max-Age: 86400
```

因此公开对象和携带正确 `key` 的受保护对象都可由任意来源的浏览器 JavaScript 读取。CORS 不会绕过密钥验证或主动暴露 `key`；但任何取得完整密钥链接的网站都能读取对应内容，因此访问密钥必须保持高熵且不得复用重要密码。本项目不使用 Cookie 凭据，也不返回 `Access-Control-Allow-Credentials`。

## Files 页面

公开文件：

```text
https://example.com/_files
```

全部文件：

```text
https://example.com/_files?uuid=your-browse-uuid
```

Files 与 Status 是两个独立页面，共用亮暗主题样式和 Status / Files / License / GitHub 导航。License 使用奖章图标，在当前页面以弹窗展示仓库内置的 MIT License，可用关闭按钮、Esc 或点击遮罩关闭。列表在内容区居中，桌面端按 Object Key / Access / Type / Size / Uploaded / Copy / Open / Download 紧凑排列；窄屏自动切换为带 44px Copy、Open 和 Download 图标按钮的卡片。文件主体仅展示信息，点击 Open 按钮打开对象，点击 Download 按钮则使用 `download=1` 触发浏览器下载。Copy 复制对应 Open 的完整绝对链接（受保护对象保留 `key`，不包含浏览凭据 UUID 或 `download=1`）；成功或失败会给出提示。

- Status 与 Files 的中心内容最大宽度统一为 1120px，操作列按 Copy / Open / Download 排列；顶部不显示 Public access / Protected access 标签，标题旁的 Public Access / Protected Access 标签分别与列表中的绿色 / 黄色保持一致。
- 右上角太阳 / 月亮按钮切换亮暗主题，Status、Files、错误页与 License 弹窗共享 Material Design 3 色彩角色；首次跟随系统，手动选择存入本地浏览器并跨页面保留。浏览器禁用本地存储时仍可切换当前页面。
- Copy 在 HTTPS 或 localhost 安全上下文优先使用 Clipboard API；不支持时尝试浏览器复制兼容方式，拒绝复制时明确提示失败。页面只允许由固定 SHA-256 哈希授权的 UI 脚本，修改脚本时必须同步 CSP 哈希。
- 公开页只显示无需密钥的对象；全部页标签显示 `Protected`。
- 类型来自同一次 R2 `list()` 返回的 HTTP metadata；缺失时显示 `application/octet-stream`，不会逐项调用 `get()` 或 `head()`。
- 每次最多查询 200 项，并依据 R2 的 `truncated` 与 cursor 分页；缺失、超长或重复的后续 cursor 会受控失败，避免静默截断或分页循环。
- 全部文件的后续页使用 `BROWSE_UUID` 签发的 cursor 专用 HMAC-SHA-256 令牌，不重复暴露 UUID。
- 上传时间精确到秒。默认示例为 `25 Aug 2026 08:00:00`，表头显示 `Uploaded (GMT+8)`；自定义时区时显示对应 IANA 名称。
- 时间格式化器只复用最近一个有效时区的实例，避免每次请求重复初始化；切换时区会替换实例，无效时区仍返回配置错误。缓存不保存文件元数据或凭据。
- 页面不显示 UUID 或密钥文本，但受保护对象链接本身包含 `key`，可在浏览器开发者工具中查看。
- 受保护对象的下载链接同样包含现有 `key`，并沿用完全相同的鉴权。
- 页面使用 `no-store`、`no-referrer`、`noindex`、CSP、禁止嵌入、HTML 转义和 URL 编码。
- `/_files` 只查询和读取，不提供上传、覆盖或删除功能。

## 本地页面预览

运行 `node scripts/preview.mjs`，访问 `http://127.0.0.1:8799/` 或 `http://127.0.0.1:8799/_files?uuid=preview-browse`。服务仅绑定本机，使用内存中的模拟文件和演示访问密钥，不读取上传配置，不连接 Cloudflare，不写入 R2。用 Ctrl+C 停止。

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
- `BROWSE_UUID` 是 Bearer 凭据，应使用高熵随机值且不得分享；首次授权 URL 可能进入浏览器历史和边缘访问日志。轮换它不会撤销已取得的单文件链接；撤销单文件链接需轮换对应 `ACCESS_KEYS` 值。
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

R2Gate 使用 [MIT License](LICENSE)。页面中的 License 组件直接呈现许可证内容，不会跳转到外部页面。

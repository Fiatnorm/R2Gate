# R2Gate

[![CI](https://github.com/Fiatnorm/R2Gate/actions/workflows/ci.yml/badge.svg)](https://github.com/Fiatnorm/R2Gate/actions/workflows/ci.yml)

R2Gate 是一个精简的 Cloudflare R2 文件读取与上传工具：

- Worker / Pages 使用 R2 Binding 读取文件。
- 每个 R2 Object Key 可以配置不同访问密钥，也可以公开访问。
- `/_files` 查询公开文件，携带正确 UUID 时查询全部文件。
- Python 脚本通过 R2 S3 Compatible API 创建或覆盖对象。
- 不包含登录系统、JWT、数据库、管理后台或 Presigned URL。

## 文件说明

- `worker.mjs`：Cloudflare Worker 入口。
- `pages-dist/_worker.js`：Cloudflare Pages Direct Upload 产物。
- `wrangler.toml`：Wrangler 部署配置。
- `upload_r2.py`：R2 S3 API 上传脚本。
- `config.example.json`：不含真实密钥的上传配置示例。
- `config.json`：本地真实上传配置，已被 Git 忽略。

访问 Worker 或 Pages 的根路径时，程序会先检查 `BUCKET` Binding，以及 `ACCESS_KEYS` 和 `BROWSE_UUID` 这两个普通文本变量。三项配置有效后才返回独立的 Material Design 3 深色 Status 页面，其中显示以下英文状态信息：

```text
R2Gate is running successfully.
```

Status 与 Files 使用统一的 Material Design 3 深色布局；左侧导航可在两个独立页面之间切换，并提供 GitHub 项目入口。页面使用根据项目图标制作的轻量橙色数据库 SVG 作为品牌图标和浏览器 favicon；`/favicon.svg` 与兼容路径 `/favicon.ico` 均可直接访问该图标。

自检失败时返回 `500` 和对应英文提示：

- 未正确添加 R2 Binding：`R2 bucket binding is not configured`
- 未添加或留空 `ACCESS_KEYS`：`ACCESS_KEYS variable is not configured`
- 未添加或留空 `BROWSE_UUID`：`BROWSE_UUID variable is not configured`
- `ACCESS_KEYS` 不是有效 JSON 对象：`Invalid ACCESS_KEYS configuration`

## Worker 部署

### Cloudflare Dashboard 手动部署

1. 进入 **Workers & Pages**，创建一个 Worker。
2. 打开 **Edit code**，使用 `worker.mjs` 的完整内容替换示例代码并部署。
3. 进入 **Settings > Bindings > Add > R2 Bucket**：
   - Variable name：`BUCKET`
   - R2 bucket：选择实际 Bucket
4. 进入 **Settings > Variables and Secrets > Add**，添加普通文本变量：
   - Type：Plaintext / 普通文本
   - Variable name：`ACCESS_KEYS`
   - Value：`{"files/private-a.txt":"key-a","files/private-b.txt":"key-b"}`
5. 再添加一个普通文本变量：
   - Type：Plaintext / 普通文本
   - Variable name：`BROWSE_UUID`
   - Value：自行生成且不对外分享的随机 UUID
6. 再次部署，然后访问 Worker 提供的 `workers.dev` 链接。

`ACCESS_KEYS` 不使用 Secret 类型，但必须添加。将其设置为 `{}` 时，所有文件都不需要访问密钥。

### Wrangler 部署

编辑 `wrangler.toml`：

```toml
[vars]
ACCESS_KEYS = "{\"files/private-a.txt\":\"key-a\"}"
BROWSE_UUID = "your-random-uuid"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"
```

配置完成后部署：

```powershell
npx wrangler deploy
```

`ACCESS_KEYS` 和 `BROWSE_UUID` 都是必填的 Plaintext / 普通文本变量。仓库内的 `wrangler.toml` 将 `BROWSE_UUID` 留空以确保示例配置不会携带可用凭据；部署前必须替换为自行生成且不对外分享的随机 UUID，否则所有受配置检查保护的请求都会返回 `500`。

部署后访问：

```text
https://your-worker.your-subdomain.workers.dev/
```

## Pages Direct Upload 部署

`pages-dist` 是专用上传目录，其中只包含 Pages Advanced Mode 所需的 `_worker.js`，不会包含本地 `config.json`。

1. 进入 **Workers & Pages > Create application > Get started > Drag and drop your files**。
2. 上传整个 `pages-dist` 目录或该目录的 ZIP 文件。
3. 创建完成后进入 Pages 项目的 **Settings > Bindings**，添加 R2 Bucket：
   - Variable name：`BUCKET`
   - R2 bucket：选择实际 Bucket
4. 进入 **Settings > Variables and Secrets**，添加普通文本变量 `ACCESS_KEYS`。
5. 在同一位置添加普通文本变量 `BROWSE_UUID`，值为自行生成且不对外分享的随机 UUID。
6. 为 Production 和需要使用的 Preview 环境配置相同绑定，然后重新部署。

Pages 根路径返回相同的成功消息，文件访问规则也与 Worker 完全一致。

## Pages Fork 仓库部署

通过 GitHub Fork 部署后，每次推送到 Fork 仓库都可以自动触发 Pages 构建：

1. 打开 [Fiatnorm/R2Gate](https://github.com/Fiatnorm/R2Gate)，点击 **Fork**，将仓库复制到自己的 GitHub 账号。
2. 进入 Cloudflare **Workers & Pages > Create application > Pages > Connect to Git**。
3. 授权 Cloudflare GitHub App，然后选择刚刚 Fork 的 `R2Gate` 仓库。
4. 使用以下构建配置：
   - Production branch：`main`
   - Framework preset：`None`
   - Build command：`exit 0`
   - Build output directory：`pages-dist`
   - Root directory：留空
5. 点击 **Save and Deploy** 完成第一次部署。
6. 进入 Pages 项目 **Settings > Bindings**，添加 R2 Bucket Binding：
   - Variable name：`BUCKET`
   - R2 bucket：选择实际 Bucket
7. 进入 **Settings > Variables and Secrets**，添加普通文本变量：
   - Variable name：`ACCESS_KEYS`
   - Value：私有文件使用 JSON 映射；全部公开时填写 `{}`
8. 添加普通文本变量 `BROWSE_UUID`，值为自行生成且不对外分享的随机 UUID。
9. 为 Production 和需要使用的 Preview 环境配置相同内容，然后重新部署。

Git 集成项目会在 Fork 仓库的 `main` 分支有新提交时自动部署。Cloudflare Pages 的 Git 集成项目与 Direct Upload 项目是两种不同的项目类型，应在创建项目时选择需要的方式。

## 文件访问

需要密钥：

```text
https://example.com/files/private-a.txt?key=key-a
```

公开文件：

```text
https://example.com/files/public.txt
```

规则：

- URL 路径去掉开头的 `/` 后就是 R2 Object Key。
- Object Key 在 `ACCESS_KEYS` 中且密钥正确：返回文件。
- 密钥错误或缺失：返回 `403 Forbidden`。
- Object Key 未配置密钥：直接读取。
- 文件不存在：返回 `404 Not Found`。
- 仅支持 `GET` 和 `HEAD`，其他方法返回 `405 Method Not Allowed`。

## 文件查询页面

Files 页面使用与 Status 页面统一的 navigation rail，并采用紧凑列表分别显示 Object Key、访问状态、大小和上传日期。页面不显示 Status 内容、UUID 或访问密钥文本。

只查询不需要访问密钥的公开文件：

```text
https://example.com/_files
```

查询全部公开和受保护文件：

```text
https://example.com/_files?uuid=your-browse-uuid
```

规则：

- `BROWSE_UUID` 必须作为 Cloudflare Plaintext / 普通文本变量配置；查询参数 `uuid` 与它完全一致时才显示全部文件。
- `BROWSE_UUID` 缺失或留空时，根路径、公开文件查询、全部文件查询和文件读取都会返回 `500`；缺少查询参数 `uuid` 时仍只显示 `ACCESS_KEYS` 中没有非空密钥的对象。
- 携带错误、空白或重复的 `uuid` 返回 `403 Forbidden`，且不会发起 R2 列表请求。
- 页面每次通过一次 `BUCKET.list()` 最多读取 200 个对象；Bucket 较大时使用 R2 cursor 打开下一页。
- 全部文件查询的后续页使用由 `BROWSE_UUID` 对 cursor 生成的 HMAC-SHA-256 分页令牌，下一页 HTML 和网址不会重复包含 UUID；令牌只对对应 cursor 有效。
- 页面中的文件链接使用 `/_files?object=<Object Key>`；受保护文件自动增加经过 URL 编码的 `key` 参数，点击后沿用现有文件鉴权规则。
- 查询页面不显示 UUID 或访问密钥文本，但受保护文件的完整链接本身包含对应密钥，可以在浏览器开发者工具中查看。
- 查询页面设置 `no-store`、`no-referrer`、`noindex`、CSP 和禁止嵌入响应头，文件名经过 HTML 转义，Object Key 和访问密钥经过 URL 编码。
- 受保护文件响应会覆盖为 `private, no-store` 并设置 `no-referrer`，避免带 key 的内容地址被缓存或作为 Referer 发送。
- `/_files` 页面只查询和读取对象，不提供上传、覆盖或删除功能。

## Python 上传脚本

本仓库默认使用 `.venv` 中的 Python。

首次配置：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .\config.example.json .\config.json
```

编辑 `config.json`：

```json
{
  "R2_ACCOUNT_ID": "your-account-id",
  "R2_ACCESS_KEY_ID": "your-r2-access-key-id",
  "R2_SECRET_ACCESS_KEY": "your-r2-secret-access-key",
  "R2_BUCKET_NAME": "your-bucket-name",
  "LOCAL_FILE": "test.txt",
  "R2_OBJECT_KEY": "files/test.txt"
}
```

`LOCAL_FILE` 可以是绝对路径，也可以是相对于 `config.json` 的路径。
上传时会优先根据 R2 Object Key、其次根据本地文件扩展名自动写入 `Content-Type`。脚本为 CSV、XML、ZIP、GZIP、7z、RAR、WebP、FLAC、AAC、AVI、WOFF、WOFF2、TTF、OTF 和 SH 提供跨平台固定映射，其余类型交给 Python `mimetypes` 判断，无法识别时使用 `application/octet-stream`。

运行：

```powershell
.\.venv\Scripts\python.exe .\upload_r2.py
```

对象不存在时：

```text
[CREATE] files/test.txt
[SUCCESS] Upload completed
```

对象已存在时：

```text
[UPDATE] files/test.txt
[SUCCESS] Upload completed
```

## 安全说明

- 不要提交或分享 `config.json`。
- 不要把 `R2_SECRET_ACCESS_KEY` 放入 Worker、Pages、URL 或前端代码。
- R2 Bucket 应保持非公开，避免通过 `r2.dev` 或 Bucket 自定义域名绕过 Worker。
- `ACCESS_KEYS` 是普通文本访问密码映射，可能出现在 Dashboard、URL、浏览器历史和访问日志中；不要复用重要密码。
- `BROWSE_UUID` 是全部文件查询页的 Bearer 凭据，应使用高熵随机 UUID 并作为普通文本变量保存；它会对拥有 Cloudflare 项目变量读取权限的人可见，其初始查询网址也可能进入浏览器历史和 Worker 日志，不要分享或通过第三方页面跳转访问。
- 更换 `BROWSE_UUID` 只能撤销全部文件查询页访问，不能撤销已经取得的单文件 key 链接；后者必须轮换对应的 `ACCESS_KEYS` 值。

## 持续集成

GitHub Actions 会在 Push、Pull Request 和手动触发时运行以下只读检查：

- Worker 根路径、文件查询、UUID、分页、特殊 Object Key、鉴权、GET、HEAD、403、404、405 和 R2 异常分支。
- Python CREATE/UPDATE、`Content-Type` 判断与未知类型回退。
- Worker 与 Pages 运行时代码一致性。
- Python 依赖、JSON 和 TOML 配置格式。
- `config.json`、`.venv` 和本地环境文件未被 Git 跟踪。

CI 不包含 Cloudflare 部署步骤，也不需要保存 Cloudflare API Token。

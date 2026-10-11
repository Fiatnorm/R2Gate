# R2Gate 项目约束

## 项目边界

- 只维护 R2 文件读取鉴权和 S3 Compatible API 上传功能。
- 不增加 JWT、登录、数据库、KV、D1、后台、Presigned URL、角色或多用户系统。
- Worker 的 R2 Binding 名称固定为 `BUCKET`。
- `ACCESS_KEYS` 使用普通文本变量，值为 Object Key 到访问密钥的 JSON 映射。
- `BROWSE_UUID` 使用必填的普通文本变量，只作为全部文件查询页的 Bearer 凭据。
- `ACCESS_KEYS` 的键和值必须非空且各不超过 4096 字符；公开对象必须从映射中省略。`BROWSE_UUID` 最长 128 字符。

## 运行时代码

- `worker.mjs` 是 Worker 入口。
- `pages-dist/_worker.js` 是 Pages Direct Upload 入口。
- 修改运行时行为时必须同步这两个文件，并验证内容完全一致。
- 根路径必须先验证 `BUCKET` Binding、`ACCESS_KEYS` 和 `BROWSE_UUID` 普通文本变量；三者有效时才返回英文 `R2Gate is running successfully.`。
- 配置检查必须一次收集并显示全部已发现问题，不得只返回第一个问题。
- `DISPLAY_TIME_ZONE` 是可选普通文本变量，默认使用 `Asia/Singapore`；必须接受有效 IANA 时区并将 Files 上传时间精确到秒。
- `/_files` 只列出不需要密钥的对象；`/_files?uuid=<UUID>` 验证 `BROWSE_UUID` 后列出全部对象，并为受保护对象生成携带现有 `key` 参数的链接。
- 保留 `/<Object Key>?key=<访问密钥>` 直链和 `/_files?object=<Object Key>&key=<访问密钥>` 查询页链接，两者必须沿用相同鉴权；不得把首个查询分隔符 `?` 改为 `&`。
- 直链路径必须按标准百分号编码解码；无法解码、为空或超过 4096 字符时返回 `400`，不得读取 R2。
- 所有响应必须返回 `Access-Control-Allow-Origin: *`、`Access-Control-Allow-Methods: GET, HEAD, OPTIONS` 和 `Access-Control-Max-Age: 86400`；`OPTIONS` 返回 `204`，不得读取 R2。
- 直链和 `/_files?object=...` 查询链接携带且仅携带一个 `download=1` 时必须以 Object Key 最后一个路径段生成安全的 `Content-Disposition: attachment`；重复或其他值返回 `400`，且不得读取 R2。
- 受保护对象必须且只能携带一个 `key` 参数，并使用定时安全比较；重复或错误的 `key` 不得触发 R2 读取。
- 文件查询必须使用 R2 cursor 分页，每次 `BUCKET.list()` 最多读取 200 个对象；不得按文件额外调用 `get()` 或 `head()` 获取列表元数据。
- 全部文件查询的后续页必须使用 `BROWSE_UUID` 签发的 cursor 专用 HMAC 令牌，不得在分页链接中重复 UUID。
- R2 返回 `truncated=true` 时必须提供非空、长度合规且不同于当前页的 cursor，否则受控返回 `500`，避免截断或循环。
- 查询页不得缓存或向 Referer 泄露 UUID；Object Key 必须进行 HTML 转义和 URL 编码，不得把 UUID 显示在页面正文中。
- `/` Status 与 `/_files` Files 必须保持为两个独立页面，共用 1120px 内容宽度、Material Design 3 亮暗主题样式、橙色数据库图标和 Status / Files / License / GitHub 左侧导航；Status 在桌面视口中纵向居中，License 在当前页面以弹窗呈现仓库内置的 MIT License，不得跳转到外部页面。Files 使用 Object Key / Access / Type / Size / Uploaded 顺序的紧凑列表，并在末尾提供独立 Copy / Open / Download 组件，不在页面之间混入对方的主体内容。
- Files 顶部不显示 Public access / Protected access 标签；标题旁 Public Access / Protected Access 标签分别与列表的绿色 / 黄色使用相同主题变量。操作列顺序固定为 Copy / Open / Download。
- Files 列表在内容区居中，桌面宽度受控且各列间距均衡；窄屏切换为紧凑卡片，不允许产生横向滚动。
- 页面共享右上角亮暗主题切换；首次跟随系统，手动选择保存在浏览器本地。Copy 复制对应 Open 的绝对链接，保留单文件 `key`，不得复制浏览 UUID 或下载参数；复制失败必须提示。UI 脚本仅通过固定 CSP SHA-256 哈希授权，修改脚本须同步哈希。
- 本地预览：`node scripts/preview.mjs`，仅使用模拟 R2 数据，监听 `127.0.0.1:8799`。
- Pages 上传只能使用 `pages-dist`，不得上传仓库根目录。
- `direction-approved.md` 仅是历史决策记录，不得保留或重新加入仓库。

## Python

- 所有 Python、pip、脚本和测试命令默认使用 `.venv\Scripts\python.exe`。
- 安装依赖使用 `.venv\Scripts\python.exe -m pip install -r requirements.txt`。
- 不使用系统 Python 直接运行 `upload_r2.py`。
- 上传脚本优先按 R2 Object Key、其次按本地文件名判断 `Content-Type`；常见平台差异类型使用 `MIME_TYPE_OVERRIDES`，其余交给 Python `mimetypes`，未知类型回退为 `application/octet-stream`。

## 安全与发布

- `config.json`、`.venv`、上传目标文件和任何真实密钥不得提交。
- GitHub 只提交 `config.example.json`，不得提交本地 `config.json`。
- 发布前检查 `git status`、暂存文件和 `git ls-files`，确认没有真实 API 凭据。
- 未经明确请求，不部署 Cloudflare 或修改真实 R2 对象。

## 验证

- JavaScript：`node --check worker.mjs`
- Worker 测试：`node --test tests/test_worker.mjs`
- Python：`.venv\Scripts\python.exe -m pip check`
- Python 测试：`.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 配置示例：使用 Python `json` 模块解析 `config.example.json`
- Pages 一致性：比较 `worker.mjs` 与 `pages-dist/_worker.js`
- 行为验证至少覆盖根路径成功、缺少或不完整 Binding、缺少或无效 `ACCESS_KEYS`、缺少 `BROWSE_UUID`、公开/全部文件查询、UUID、分页、特殊 Object Key、重复 key、CORS、OPTIONS、下载、GET、HEAD、400、403、404、405 和 R2 异常。

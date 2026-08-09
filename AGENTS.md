# R2Gate 项目约束

## 项目边界

- 只维护 R2 文件读取鉴权和 S3 Compatible API 上传功能。
- 不增加 JWT、登录、数据库、KV、D1、后台、Presigned URL、角色或多用户系统。
- Worker 的 R2 Binding 名称固定为 `BUCKET`。
- `ACCESS_KEYS` 使用普通文本变量，值为 Object Key 到访问密钥的 JSON 映射。

## 运行时代码

- `worker.mjs` 是 Worker 入口。
- `pages-dist/_worker.js` 是 Pages Direct Upload 入口。
- 修改运行时行为时必须同步这两个文件，并验证内容完全一致。
- 根路径必须先验证 `BUCKET` Binding 和 `ACCESS_KEYS` 普通文本变量；两者有效时才返回英文 `R2Gate is running successfully.`。
- Pages 上传只能使用 `pages-dist`，不得上传仓库根目录。

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
- 行为验证至少覆盖根路径成功、缺少 Binding、缺少或无效 `ACCESS_KEYS`、GET、HEAD、403、404、405 和 R2 异常。

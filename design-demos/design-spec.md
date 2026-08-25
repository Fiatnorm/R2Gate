# R2Gate Material Design 3 深色重设计规范

## 目标与边界

本轮重设计覆盖 R2Gate 的运行状态页和文件查询页，核心任务是让用户一眼理解当前访问范围、快速辨认公开与受保护对象，并能稳定点击文件。页面必须保持现有安全与路由语义：`/_files` 只显示公开对象，`/_files?uuid=<UUID>` 验证成功后显示全部对象，受保护对象的跳转链接继续携带现有 `key` 参数，后续分页不得重复暴露 UUID。页面只提供读取和翻页，不新增上传、删除、搜索、登录、统计或后台管理等产品能力。

## 视觉系统

采用 Material Design 3 的深色语义色与层级表面，不使用大面积渐变、玻璃拟态、发光边框或无意义装饰。背景、surface、surface-container、surface-container-high 与 outline-variant 形成清楚但克制的层级；主色只用于当前范围、主操作和焦点状态。组件形态采用 M3 的圆角、状态层、tonal/filled/outlined 按钮与清晰的容器关系。三套方向必须改变布局骨架而不只是更换颜色：A 侧重标准 navigation rail + 内容容器；B 采用 M3 Expressive 的大标题、对比形状和底部工具区；C 采用 supporting pane/紧凑数据列表，强调高效率浏览。

## 字体与信息层级

字体栈优先使用 `Roboto Flex`、`Roboto`，并为中文提供 `Noto Sans SC`、`PingFang SC`、`Microsoft YaHei` 回退，不依赖运行时外部字体请求。页面标题使用 Display/Headline 层级，列表主文件名使用 Title/Body Large，大小和日期使用 Body Medium，状态标签使用 Label Medium。正文最小 14px，主要正文 16px；长 Object Key 必须允许合理换行或省略，完整值可由链接标题提示，不允许撑破布局。

## 交互与响应式

所有可点击目标至少 44×44px，保留清楚的 hover、focus-visible 和 pressed 状态；键盘焦点不能只依靠颜色表达。桌面以 1440×900 为主要评审尺寸，同时必须适配 390×844：侧栏在窄屏转为顶栏或底栏，多列元数据转为紧凑的两行列表，不产生水平滚动。文件行整体可点击，但可见标签和图标不得遮挡文件名。分页只有存在下一页时显示，主按钮文字保持 `Next page`；没有对象时显示简短空状态。

## 真实内容与文案

初稿使用与 R2Gate 行为一致的英文界面，不虚构容量、访问量或在线统计。示例对象包含 `public.txt`、`docs/guide.pdf`、`private.txt`、`目录/测试文件.txt`，分别展示 Public 或 Protected；标题使用 `Public files` 或 `All files`，状态页保留 `R2Gate is running successfully.`。页面应明确提醒 Protected 链接包含访问 key，避免转发，但不得把 UUID 或 key 明文展示在列表中。

## 可访问性与性能

深色文本和控件对比度以 WCAG AA 为最低目标；图标与文字共同表达状态，不能只使用红绿或纯颜色。HTML/CSS/图标全部内嵌，无框架、无图片、无外部脚本和字体，确保 Cloudflare Worker 返回体小、首屏快、无额外网络请求。动画仅用于短暂状态层或位移反馈，并尊重 `prefers-reduced-motion`。最终生产实现必须同步 `worker.mjs` 与 `pages-dist/_worker.js`，并以浏览器截图、键盘交互、移动端溢出检查和现有自动化测试共同验收。

# Memos 快速发送

一个 Chrome / Edge 扩展,用于把浏览器里选中的文本、当前页面、链接和图片一键发送到你自己的 [Memos](https://github.com/usememos/memos) 实例(例如部署在 Cloudflare Workers 上的 memos-api)。

## 功能

- **右键菜单**:对选中文本、页面、链接、图片分别生成格式化的 memo
  - 选中文本 → 以 Markdown 引用块保存,并附出处链接
  - 页面 / 链接 → 保存为 `[标题](URL)`
  - 图片 → 自动下载并上传为 resource,附带来源页面
- **弹窗编辑器**:随时记一条 memo,支持 `#标签`,可选附加当前页面链接,并选择可见性(仅自己 / 登录可见 / 公开)
- **键盘快捷键**
  - `Ctrl/Cmd + Shift + M`:打开弹窗
  - `Ctrl/Cmd + Shift + S`:把当前选中文本直接存为 memo
- **设置页**:配置后端 URL、Access Token、默认可见性;支持用户名密码快速登录换取 JWT;提供一键"测试连接"
- **桌面通知**:成功与失败都会通过系统通知反馈

## 安装(开发者模式)

1. 克隆本仓库
   ```bash
   git clone https://github.com/<you>/cfmemos-extension.git
   ```
2. 打开 `chrome://extensions`,开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**,选择本项目根目录(含 `manifest.json`)

> 首次加载后,请把 `icons/icon128.png` 等图标放到 `icons/` 目录,否则通知可能没有图标。

## 配置

点击扩展图标 → 弹窗里的"设置",或在扩展管理页点击"详情 → 扩展程序选项",填写:

- **后端 URL**:形如 `https://memos-api.your-subdomain.workers.dev`,末尾不要带斜杠
- **访问令牌**:两种方式任选其一
  - 在 Memos 网页端 **设置 → 我的账户 → Access Tokens** 中创建
  - 在设置页"快速登录"区域,用用户名密码直接登录换取 JWT
- **默认可见性**:`PRIVATE` / `PROTECTED` / `PUBLIC`
- **弹窗默认附加当前页面链接**:开关

保存后点击 **测试连接**,应显示当前登录用户名。

## 项目结构

```
manifest.json          # MV3 清单
src/
  background.js        # Service Worker:右键菜单、快捷键、发送逻辑
  lib/
    api.js             # Memos API 封装(ping / auth / memo / resource)
    storage.js         # chrome.storage.local 读写与归一化
  popup/               # 点击图标时的弹窗 UI
  options/             # 扩展选项页
icons/                 # 扩展图标
```

## 使用的 API

| 接口 | 用途 |
| --- | --- |
| `POST /api/v1/auth/signin` | 用户名密码登录换取 JWT |
| `GET  /api/v1/auth/status` | 测试连接、校验令牌 |
| `POST /api/v1/memo`        | 创建 memo |
| `POST /api/v1/resource`    | 上传图片等附件 |

所有请求都会带上 `Authorization: Bearer <token>`。

## 权限说明

| 权限 | 原因 |
| --- | --- |
| `contextMenus` | 注册右键菜单项 |
| `storage` | 保存后端 URL、令牌与偏好 |
| `activeTab` + `scripting` | 读取当前页面的选中文本和标题 |
| `notifications` | 发送成功 / 失败的系统通知 |
| `host_permissions: <all_urls>` | 允许抓取任意页面的图片资源上传到 Memos |

扩展不会上传任何数据到第三方,所有请求只发往你配置的后端 URL。

## 许可证

MIT

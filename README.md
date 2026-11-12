# Mall Desktop

跨平台桌面演示应用（Windows 为主，macOS 同步可用）：**登录 → 案件办理单录入 → 操作日志**，数据全部落本机 SQLite，不依赖任何后端服务。

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 壳 | Electron 45 | 同一套代码出 `.exe` / `.dmg`，生态最稳 |
| 构建 | electron-vite 6 + Vite 8 | 主进程 / preload / 渲染进程三段式构建，HMR 快 |
| UI | Vue 3 + TypeScript + Element Plus 2.14 | 表单按 Element Plus 分组卡片 1:1 复刻 |
| 数据 | **内置 `node:sqlite`（零原生依赖）**，回退 better-sqlite3 13（N-API 预编译） | 主进程独占；驱动层 `sqlite-driver.ts` 统一接口，运行时自动选择，可用 `MALL_SQLITE_DRIVER=better-sqlite3` 强制回退；两种驱动都**不需要 node-gyp、VS Build Tools、Python** |
| 打包 | electron-builder 26 | mac → dmg(arm64)；win → nsis + portable(x64) |

## 功能

1. **登录**：`admin / 123456`（首次启动自动种子，scrypt 加盐哈希，绝无明文/MD5）。密码错会记一条 `login_failed` 日志；勾选「记住我」后下次启动自动登录（钥匙串可用时用 `safeStorage` 加密，不可用时降级为 600 权限的令牌文件）。
2. **案件录入**：六个分组卡片（案件信息 / 超期信息 / 办案人员 / 签批信息 / 其他信息 / 附件管理）+ 条件校验（超期必填原因、办结时间不晚于今天、审核时间不早于一年前）+ 原生附件多选上传/下载/批量删除。
3. **操作日志**：时间倒序分页表格，动作筛选 + 关键词搜索 + 导出 CSV，成功/失败用不同颜色 tag 区分。

## 开发

```bash
pnpm install      # 首次：装依赖（postinstall 会处理原生依赖，本项目实际无需编译）
pnpm dev          # 开发模式（HMR）
pnpm build        # 只构建产物到 out/
```

默认账号：`admin / 123456`。

数据位置（卸载应用不会自动清除）：

- macOS：`~/Library/Application Support/MallDesktop/`（`app.db` + `attachments/`）
- Windows：`%APPDATA%\MallDesktop\`

## 打包

### macOS（本机已验证）

```bash
pnpm build:mac
# 产物：release/MallDesktop-0.1.0-arm64.dmg（约 120 MB）
```

### Windows（在 Windows 机器上执行）

前置条件**只需要**：Node.js 20+ 与 pnpm（`npm i -g pnpm`）。
数据层默认走 Electron 内置的 `node:sqlite`（零原生模块），回退用的 better-sqlite3 13 也自带 N-API 预编译产物（`prebuilds/win32-x64.node`），因此**不需要 Visual Studio Build Tools，也不需要 Python**。

```bash
pnpm install
pnpm build:win
# 产物：
#   release/MallDesktop Setup 0.1.0.exe   （NSIS 安装包）
#   release/MallDesktop-0.1.0-portable.exe（免安装单文件）
```

### 安装包未签名

- macOS：首次打开被 Gatekeeper 拦住时，**右键 dmg 里的 MallDesktop → 打开**，或到「系统设置 → 隐私与安全性」点「仍要打开」。
- Windows：SmartScreen 提示「Windows 已保护你的电脑」时，点「更多信息 → 仍要运行」。

## 目录结构

```
src/main/       主进程：窗口、单实例锁、数据层（db.ts + sqlite-driver.ts）、密码哈希（auth.ts）、IPC 注册（ipc.ts）
src/preload/    contextBridge 白名单 API（contextIsolation: true / nodeIntegration: false）
src/renderer/   Vue 3 界面：登录、工作台、案件录入、案件列表、操作日志
scripts/        electron-builder afterPack 钩子（裁掉非当前平台的预编译 .node）
```

## 安全边界

- 渲染进程不碰 Node：只通过 preload 暴露的白名单 IPC 访问数据层。
- 数据库只由主进程打开（WAL + busy_timeout=5000），schema 用 `schema_version` 顺序迁移，不上 ORM。
- 附件实体存 `userData/attachments/<uuid>_<原名>`，库里只存元数据。

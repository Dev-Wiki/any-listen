# 项目架构分析

## 模块依赖关系图

```
view-main (Svelte UI)
  ├── @shared/common, @shared/i18n, @shared/web
  └── [Vite mode: desktop|web]
        ├── desktop mode → desktop (Electron main)
        │     ├── @shared/app, @shared/nodejs, @shared/common, @shared/i18n, @shared/theme
        │     └── Electron native APIs, better-sqlite3
        └── web mode → web-server (Koa)
              ├── @shared/app, @shared/nodejs, @shared/common, @shared/i18n, @shared/theme, @shared/web
              └── Koa, ws (WebSocket), better-sqlite3
```

核心共享依赖链：
```
@shared/app ← @shared/nodejs, @shared/common, @shared/i18n, @shared/theme, @shared/web
@shared/nodejs ← @shared/common
@shared/web ← @shared/common
```

## 核心功能流

1. **UI 渲染** (`view-main/src/main.ts` → `App.svelte`)
   - 初始化 Workers、注册 IPC 模块、连接 IPC 通道
   - 桌面端通过 `message2call` 与主进程通信
   - Web 端通过 WebSocket 与 Koa 服务端通信

2. **播放器** (`shared/app/modules/player`)
   - 音频播放、播放列表管理、歌词同步

3. **音乐库** (`shared/app/modules/musicList`, `shared/app/modules/music`)
   - 本地文件扫描、WebDAV 远程文件、元数据匹配、歌词匹配

4. **扩展系统** (`shared/app/modules/extension`)
   - 扩展安装、管理、沙箱化 VM 执行

5. **代理服务** (`shared/app/modules/proxyServer`)
   - 音乐流代理、缓存管理

## 架构模式

**分层架构 + 共享内核 (Shared Kernel)**

- **表现层** (`packages/view-main`): Svelte 组件，无平台依赖
- **应用层** (`packages/shared/app`): 业务逻辑，平台无关
- **基础设施层**: `@shared/nodejs` (Node.js), `@shared/web` (浏览器)
- **入口适配层**: `packages/desktop` (Electron), `packages/web-server` (Koa)
- **共享基础层**: `@shared/common` (常量、类型、通用工具)

## 模块接口与通信方式

- **Desktop IPC**: Electron `ipcMain`/`ipcRenderer` + `message2call` RPC 封装
- **Web IPC**: WebSocket + `message2call` RPC 封装
- **UI ↔ 主进程/服务端**: 统一通过 `message2call` 的 Action/Event 模式
- **数据库**: `better-sqlite3` 同步 SQLite，通过 `@shared/app` 的 Store 层访问
- **跨平台隔离**: `@shared/nodejs` 仅用于 Node.js 环境，`@shared/web` 仅用于浏览器环境

## 关键模块标记

- **`@shared/app`**: 核心业务下沉层，desktop 和 web-server 共同依赖，包含播放器、歌单、扩展、代理等全部业务逻辑
- **`@shared/common`**: 最底层共享模块，定义全项目常量、类型、Action 基类，被所有其他模块依赖
- **`packages/view-main`**: UI 层，通过 Vite mode 切换 desktop/web 构建目标，共享同一套 Svelte 代码
- **`packages/desktop`**: Electron 入口，负责窗口生命周期、原生模块加载、IPC 桥接
- **`packages/web-server`**: Koa HTTP + WebSocket 服务端，提供 REST API 和实时通信

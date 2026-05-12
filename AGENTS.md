# AGENTS.md — AI 编码助手约束规范

> 项目：Any Listen

## 1. 项目上下文速查

- **语言/框架**: TypeScript 5+, Svelte 5 (runes mode), Koa 3, Electron 40, Vite 8
- **架构模式**: 分层架构 + 共享内核（Monorepo）
- **核心入口**:
  - 桌面端: `packages/desktop/src/index.ts` → Electron `app.whenReady()`
  - Web 端: `packages/web-server/src/server.ts` → Koa `app.listen()`
  - UI 端: `packages/view-main/src/main.ts` → Svelte `mount(App)`
- **SDK 调用链**: UI → `message2call` RPC → Desktop (ipcMain) / Web (WebSocket) → `@shared/app` 业务层
- **关键版本点**:
  - Node.js >= 22.12.0 || ^20.19.0
  - pnpm 10.33.2+
  - `NATIVE_VERSION = 9`（`packages/shared/common/constants.ts`）
  - `EXTENSION_ENGINE = '1.1.2'`

## 2. 命名与风格约束

- **文件命名**: PascalCase (`Action.ts`, `SafeFS.ts`, `App.svelte`)，少量 camelCase (`index.ts`, `constants.ts`)
- **变量/函数**: camelCase (`checkAndCreateDir`, `onDomSizeChanged`)
- **常量**: UPPER_SNAKE_CASE (`NATIVE_VERSION`, `DEV_SERVER_PORTS`)
- **类型/接口**: PascalCase (`WindowSize`, `AnyListen.Config`)
- **格式化**: 无分号 (`semi: false`)，单引号 (`singleQuote: true`)，2 空格缩进，printWidth 130
- **格式化工具**: oxfmt + prettier-plugin-organize-imports
- **ESM/CJS 混合**: 顶层 packages 使用 `"type": "module"`，但 web-server 使用 `.cjs` 入口
- **导入风格**: 使用 `@/` 别名指向各包 `src/` 目录；workspace 依赖使用 `workspace:@shared/xxx@*`
- **JSDoc**: 允许但非强制，关键公共 API 需带

## 3. 架构边界规则

- **`@shared/common` 不能依赖任何其他共享模块**（最底层）
- **`@shared/web` 仅能在浏览器环境使用**，严禁引入 Node.js API
- **`@shared/nodejs` 仅能在 Node.js 环境使用**，严禁引入 DOM API
- **`@shared/app` 是唯一业务逻辑层**，desktop 和 web-server 的 `src/modules/` 仅做路由/适配
- **`packages/view-main` 不可直接引用 `electron` 或 `koa`**
- **桌面端 IPC**: `packages/desktop/src/modules/` → Electron `ipcMain`；UI 端通过 `message2call` 调用
- **Web 端 IPC**: `packages/web-server/src/modules/` → WebSocket handler；UI 端通过 `message2call` 调用

## 4. 禁止操作清单

- **禁止在 `@shared/app` 中引入 `electron` 或 `koa` 等平台特定依赖**
- **禁止在 `@shared/nodejs` 中使用浏览器 API (window, document, DOM)**
- **禁止在 `@shared/web` 中使用 Node.js API (fs, path, crypto)**
- **禁止在 `packages/view-main` 中直接操作 better-sqlite3 数据库**（必须通过 IPC）
- **禁止修改 `packages/shared/theme/colorUtils.js`**（已在 `.oxfmtrc.json` ignorePatterns 中排除）
- **禁止直接修改 `pnpm-lock.yaml`**
- **禁止在 Svelte 组件中使用 `$:` 响应式语法**（项目已启用 Svelte 5 runes 模式）

**文件编码硬约束**：严禁修改任何源文件的编码格式（UTF-8 / UTF-8 BOM / UTF-16 / GBK / GB2312 / Latin-1 等）。若编码变更看似必要，必须先获得人工确认，不得绕过。此项适用于上下文中所有 AI 操作。

## 5. 高风险文件标注

| 文件 | 风险级别 | 原因 |
|------|---------|------|
| `packages/shared/app/modules/player/*` | 高 | 音频播放核心逻辑，涉及音频解码、流处理 |
| `packages/shared/app/modules/extension/*` | 高 | 扩展 VM 沙箱，安全边界核心 |
| `packages/shared/nodejs/SafeFS.ts` | 高 | 路径穿越防护，安全关键路径 |
| `packages/shared/nodejs/sign.ts` | 高 | 签名算法，扩展验证依赖 |
| `packages/shared/app/modules/proxyServer/*` | 高 | 网络代理与缓存 |
| `packages/desktop/build-config/*` | 中 | 打包配置，平台差异大 |
| `packages/shared/theme/colorUtils.js` | 中 | 被格式化工具体排除，手动维护的色彩计算 |

## 6. 新增功能标准路径

1. **纯 UI 功能**: 在 `packages/view-main/src/` 下添加 Svelte 组件/模块
2. **跨平台业务逻辑**: 在 `packages/shared/app/modules/` 下添加模块
3. **桌面端特有功能**: 在 `packages/desktop/src/modules/` 添加 IPC handler，UI 通过 `message2call` 调用
4. **Web 端特有功能**: 在 `packages/web-server/src/modules/` 添加路由/WS handler，UI 通过 `message2call` 调用
5. **通用工具函数**: Node.js 环境放 `@shared/nodejs`，浏览器环境放 `@shared/web`，平台无关放 `@shared/common`
6. **类型定义**: 在 `packages/shared/types/` 下添加 `.d.ts`

## 7. 代码安全规范

- 文件路径操作必须使用 `safeResolve`（`@shared/nodejs`）防止路径穿越
- 用户输入必须经过 `normalizePath` 规范化
- 扩展 VM 沙箱不得绕过 `EXTENSION_VM_IPC_FUNC_NAMES` 白名单
- WebSocket 连接必须通过 auth code 验证（`IPC_CODE.authMsg`）
- SQLite 查询参数必须使用 prepared statement（better-sqlite3 默认行为）

## 8. 多版本/多定制注意事项

- **双目标构建**: `view-main` 通过 Vite `mode`（`desktop` / `web`）切换构建目标
- **环境变量注入**: 通过 `build-config/desktop.js` 和 `build-config/web.js` 注入环境差异
- **平台常量**: `packages/shared/common/constants.ts` 中的 `NATIVE_VERSION` 等常量需保持同步
- **依赖版本锁定**: 部分依赖（electron, svelte, typescript 等）在 `pnpm-workspace.yaml` 中设置了 `minimumReleaseAgeExclude`

## 9. 日志规范

- **桌面端**: `electron-log`（`packages/desktop/src/shared/log.ts`）
- **Web 端**: `log4js`（`packages/web-server/src/middleware/log-http.ts`）
- **禁止使用 `console.log` 作为正式日志**，开发调试除外

## 10. 提问与探索建议

- 理解 IPC 通信机制时，从 `message2call` 的 Action/Event 注册点入手
- 理解业务逻辑时，从 `packages/shared/app/modules/` 目录树入手
- 理解 UI 组件关系时，从 `packages/view-main/src/App.svelte` 的组件树入手
- 理解数据库 schema 时，查看 `@shared/app` 中的 Store 定义
- 新增扩展 API 时，需同步更新 `EXTENSION_VM_IPC_FUNC_NAMES`

## 11. 自动识别候选

本项目为纯 TypeScript/JavaScript 项目，无 C++ Native 模块，以下为自动识别结果：

- **Monorepo 拓扑**: 自动识别完成（pnpm workspace）
- **TypeScript 配置继承链**: `tsconfig.json` → `@any-listen/eslint/tsconfig.json`
- **ESLint 配置继承链**: `eslint.config.mjs` → `@any-listen/eslint/eslint.config.mjs`
- **格式化配置**: oxfmt + prettier，配置一致

## 12. 需人工确认

- `packages/shared/nodejs/request.bak.ts` 是否为废弃文件，是否可删除
- `packages/shared/theme/colorUtils.js` 为何被排除在格式化之外，是否需要手动迁移
- 扩展 VM 沙箱的安全审计是否已完成
- `NATIVE_VERSION` 的升降级策略

## 13. 代码风格锚点（仓库抽样）

```typescript
// packages/shared/common/Action.ts — 类声明模式
export default class Action {
  private readonly actions: Map<string, (...args: any[]) => unknown>
  constructor() { this.actions = new Map() }
  exec(actionName: string, ...args: unknown[]) { ... }
  register(actionName: string, listener: (...args: any[]) => unknown) { ... }
}
```

```typescript
// packages/shared/nodejs/index.ts — 函数导出模式（命名导出 + JSDoc）
/**
 * 检查路径是否存在
 * @param path 路径
 * @param read 只检查读取
 */
export const checkPath = async (path: string, read = false) =>
  fs.promises.access(path, ...).then(() => true).catch(() => false)
```

```typescript
// packages/shared/web/index.ts — 浏览器工具函数模式
export const onDomSizeChanged = (dom: HTMLElement, onChanged: (width: number, height: number) => void) => {
  const resizeObserver = new ResizeObserver((entries) => { ... })
  resizeObserver.observe(dom)
  onChanged(dom.clientWidth, dom.clientHeight)
  return () => { resizeObserver.disconnect() }
}
```

```typescript
// packages/shared/common/constants.ts — 常量定义模式
export const NATIVE_VERSION = 9
export const STORE_NAMES = { APP_SETTINGS: 'config', DATA: 'data', ... } as const
export const DOWNLOAD_STATUS = { RUN: 'run', WAITING: 'waiting', ... } as const
```

```typescript
// packages/desktop/src/index.ts — Electron 入口模式
export const init = async () => {
  await initAppEnv()
  initI18n()
  await startCommonWorkers(appState.dataPath)
  void initModules().finally(handleInited)
  await initRenderers()
  handleInited()
}
void app.whenReady().then(() => { ... })
void init()
```

```typescript
// packages/web-server/src/server.ts — Koa 中间件组合模式
export const createServerApp = (config: AnyListen.Config) => {
  const app = new Koa()
  app.use(reqInit())
  if (config.httpLog) app.use(logHttp)
  if (config['cors.enabled']) app.use(createCors())
  app.use(streamBody)
  app.use(staticFile)
  app.use(router.routes())
  return app
}
```

## 14. 公司 Git 门禁规范

本项目受公司级 Git 工作流门禁约束，提交前必须通过以下检查。

**分支命名**：必须符合 `docs/GIT_WORKFLOW.md` 第 1 节规范。
- 字符合集：仅小写字母 `a-z`、数字 `0-9`、下划线 `_`、点 `.`（终端额外允许中划线 `-`）
- 禁止：大写字母、中文、不在白名单的基线编号
- 通用格式含 Master / Release / Feature / Bugfix / F 版本 / T 版本 / C 版本
- 终端特殊格式：`数字-feature-数字-描述` / `数字-fix-数字-描述` / `private_<基线>_<来源版本>_<日期>[f_/t_...]`

**提交信息格式**：`<Type>(<Scope>): <描述> [#<FeatureID>][#<FeatureID>]`
- Type: `feat` / `update` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `chore`
- FeatureID 在**行尾**，ONES 需求 ID（纯数字），可以有多个
- 整行 commit title 必须 > 40 字符

**调试残留拦截**：diff 中不得包含 `console.log` 临时调试代码（日志模块除外）。

**ONES ID 提取**：优先从分支名自动提取；Bugfix 分支和 Release 分支需询问用户。

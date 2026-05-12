# HARNESS

## 项目类型
Node.js/TypeScript Monorepo — Electron Desktop + Koa Web Server

## 构建命令
`pnpm build`

## 编译启动诊断
- `pnpm build:desktop` — 构建桌面端（含 electron-builder 打包）
- `pnpm build:web` — 构建 Web 端
- `pnpm dev:desktop` — 启动桌面端开发模式（Vite dev server + Electron）
- `pnpm dev:web` — 启动 Web 端开发模式（Vite dev server）
- `pnpm fmt` — 代码格式化检查（oxfmt）

## 快速验证命令
`pnpm -F view-main check`（svelte-check 类型检查）

## Bugfix 验证命令
`pnpm build:desktop`（完整桌面构建 + 打包）

## 完整验证命令
`pnpm build:desktop && pnpm build:web`（双目标全量构建）

## 高风险目录
- `packages/shared/app/modules/player/` — 音频播放核心，改动影响播放行为
- `packages/shared/app/modules/extension/` — 扩展 VM 沙箱，改动影响安全性
- `packages/shared/app/modules/proxyServer/` — 网络代理与缓存
- `packages/shared/nodejs/SafeFS.ts` — 路径穿越防护
- `packages/desktop/build-config/` — 打包配置，平台差异敏感

## 禁改区域
- `packages/shared/theme/colorUtils.js` — 被 oxfmt 排除，手动维护
- `pnpm-lock.yaml` — 由 pnpm 自动管理
- `packages/shared/common/constants.ts` 中的 `NATIVE_VERSION` 和 `EXTENSION_ENGINE` — 版本协调关键
- `.oxfmtrc.json` 中的 `ignorePatterns` — 不得随意增删

## 自动识别候选
- pnpm workspace 拓扑：已识别（`pnpm-workspace.yaml`）
- TypeScript 配置继承：`@any-listen/eslint/tsconfig.json` 基础配置
- ESLint 配置继承：`@any-listen/eslint/eslint.config.mjs` 基础配置
- 构建入口：`packages/shared/scripts/` 中的 `pack-desktop.ts` / `pack-web.ts`

## 需人工确认
- `packages/shared/nodejs/request.bak.ts` 是否可删除
- `packages/shared/theme/colorUtils.js` 迁移计划
- 扩展 VM 沙箱安全审计状态
- `NATIVE_VERSION` 升降级流程
- `pnpm-workspace.yaml` 中 `minimumReleaseAgeExclude` 列表维护策略

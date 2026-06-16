# markdown-editor

一个基于 **React + Electron + TypeScript + Vite** 的轻量级、跨平台文件编辑器。

> 详细方案见 [技术方案.md](./技术方案.md)

## 技术栈

- **桌面框架**：Electron
- **UI**：React 18 + TypeScript
- **构建**：Vite + vite-plugin-electron
- **状态管理**：Zustand
- **编辑器核心**：Monaco Editor
- **国际化**：react-i18next
- **打包**：electron-builder

## 目录结构

```
fileEdit/
├─ electron/                # Electron 主进程
│  ├─ main.ts               # 主进程入口
│  ├─ preload.ts            # 预加载脚本（暴露安全 API）
│  ├─ ipc/                  # IPC 通信模块
│  ├─ menu/                 # 应用菜单
│  └─ utils/                # 工具函数
├─ src/                     # 渲染进程（React）
│  ├─ main.tsx              # 渲染入口
│  ├─ App.tsx               # 主应用
│  ├─ components/           # 通用组件
│  │  ├─ TitleBar/
│  │  ├─ Sidebar/
│  │  ├─ TabBar/
│  │  ├─ EditorArea/
│  │  ├─ StatusBar/
│  │  └─ CommandPalette/
│  ├─ editor/               # Monaco 编辑器封装
│  ├─ store/                # Zustand 状态
│  ├─ hooks/                # 自定义 Hooks
│  ├─ views/                # 页面视图
│  ├─ utils/                # 工具函数
│  ├─ i18n/                 # 国际化
│  ├─ types/                # 类型声明
│  └─ styles/               # 全局样式
├─ resources/               # 静态资源（图标等）
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ electron-builder.yml
└─ package.json
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
# 或
npm install
```

### 2. 启动开发环境

```bash
npm run electron:dev
```

这会同时启动 Vite 开发服务器与 Electron 主进程，并自动打开应用窗口。

### 3. 构建打包

```bash
# 构建渲染 + 主进程
npm run electron:build

# 打包当前平台安装包
npm run dist

# 指定平台
npm run dist:win
npm run dist:mac
npm run dist:linux
```

打包产物输出到 `release/{version}/` 目录。

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（仅渲染进程） |
| `npm run electron:dev` | 完整开发模式（主进程 + 渲染进程） |
| `npm run build` | 构建渲染进程 |
| `npm run electron:build` | 构建主进程与渲染进程 |
| `npm run dist` | 打包安装包（electron-builder） |
| `npm run lint` | ESLint 检查 |
| `npm run format` | Prettier 格式化 |
| `npm run test` | 运行 Vitest 单元测试 |

## 安全策略

- 启用 `contextIsolation: true`
- 关闭 `nodeIntegration`
- 渲染进程只能通过 `window.electronAPI` 调用主进程
- 主进程负责所有文件系统操作

## 路线图

- [x] M1 基础框架
- [x] M2 编辑核心（编辑器 + 文件读写 + 标签页）
- [ ] M3 增强功能（文件树 / 设置中心 / 主题 / 命令面板）
- [ ] M4 完善与发布（自动更新 / 多平台打包 / 测试）

## 许可

MIT

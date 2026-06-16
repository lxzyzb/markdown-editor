import { app, BrowserWindow, shell, crashReporter } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { registerFileIpc } from './ipc/file';
import { registerWindowIpc } from './ipc/window';
import { registerRecentIpc } from './ipc/recent';
import { buildMenu } from './menu';
import { setupAutoUpdater } from './utils/autoUpdater';

const isDev = process.env.NODE_ENV === 'development';

// 在项目内创建 userData 目录，避免沙箱限制
const userDataDir = path.join(process.cwd(), '.userdata');
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}
app.setPath('userData', userDataDir);

// 禁用 crash reporter（沙箱下无法连接 Crashpad 服务，会导致进程异常退出）
// 注意：必须在最早期调用，且依赖 commandLine 开关
app.commandLine.appendSwitch('disable-crash-reporter');
app.commandLine.appendSwitch('no-crash-upload');
app.commandLine.appendSwitch('disable-features', 'CrashpadReporter');
try {
  crashReporter.start({ submitURL: '', uploadToServer: false });
} catch {
  // 忽略
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    title: 'FileEdit',
    backgroundColor: '#1e1e1e',
    // 使用系统标题栏，OS 自带最小/最大/关闭按钮
    // 自定义 TitleBar 只承担菜单/标题展示，避免重复按钮
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // 加载失败时打印日志（不自动关闭窗口）
  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] did-fail-load: ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  // 渲染端崩溃时尝试恢复
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] render-process-gone:', details);
  });

  // 外部链接使用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // 开发环境加载 Vite 开发服务器
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    win.loadURL(devUrl);
    // 关闭自动弹出的 DevTools（避免 userData 重定向后内部 fetch 报错）
    // 需要调试时手动通过命令面板或菜单"视图 → 切换开发者工具"打开
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return win;
}

app.whenReady().then(() => {
  registerFileIpc();
  registerWindowIpc();
  registerRecentIpc();
  buildMenu();
  mainWindow = createMainWindow();

  // 仅在打包后启用自动更新
  if (!isDev) {
    setupAutoUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 上保持应用活动
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

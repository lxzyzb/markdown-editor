/**
 * 自动更新工具
 * 生产环境启用，开发环境跳过
 */
import type { BrowserWindow } from 'electron';

export function setupAutoUpdater(_win: BrowserWindow): void {
  // 预留接口：
  // 1. 引入 electron-updater
  // 2. 检查更新 autoUpdater.checkForUpdates()
  // 3. 监听 update-available / update-downloaded 事件，提示用户安装
  // 当前为占位实现，避免引入未使用的依赖
}

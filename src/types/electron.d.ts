// 暴露给 window 的 Electron API 类型
import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

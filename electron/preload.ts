import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// 暴露给渲染进程的 API
const api = {
  // 文件操作
  file: {
    open: (): Promise<OpenFileResult | null> => ipcRenderer.invoke('file:open'),
    openPath: (filePath: string): Promise<OpenFileResult> =>
      ipcRenderer.invoke('file:openPath', filePath),
    save: (payload: { path: string; content: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('file:save', payload),
    saveAs: (payload: { content: string; defaultPath?: string }): Promise<{ path?: string; canceled?: boolean }> =>
      ipcRenderer.invoke('file:saveAs', payload),
  },
  // 最近打开文件
  recent: {
    list: (): Promise<RecentEntry[]> => ipcRenderer.invoke('recent:list'),
    add: (entry: RecentEntry): Promise<RecentEntry[]> =>
      ipcRenderer.invoke('recent:add', entry),
    remove: (paths: string[]): Promise<RecentEntry[]> =>
      ipcRenderer.invoke('recent:remove', paths),
    clear: (): Promise<RecentEntry[]> => ipcRenderer.invoke('recent:clear'),
  },
  // 窗口操作
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  },
  // 应用信息
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('app:getPlatform'),
  },
  // 菜单事件订阅
  menu: {
    onNewFile: (cb: () => void) => subscribe('menu:newFile', cb),
    onOpenFile: (cb: () => void) => subscribe('menu:openFile', cb),
    onSaveFile: (cb: () => void) => subscribe('menu:saveFile', cb),
    onSaveAs: (cb: () => void) => subscribe('menu:saveAs', cb),
    onFind: (cb: () => void) => subscribe('menu:find', cb),
    onReplace: (cb: () => void) => subscribe('menu:replace', cb),
  },
};

function subscribe(channel: string, cb: (...args: any[]) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: any[]) => cb(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', api);

// 全局类型
export type ElectronAPI = typeof api;

export interface OpenFileResult {
  path: string;
  name: string;
  content: string;
  encoding?: string;
}

export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

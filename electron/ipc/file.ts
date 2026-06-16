import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { promises as fsSync } from 'node:fs';
import path from 'node:path';
import { detectEncoding } from '../utils/encoding';

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[main] unhandledRejection:', err);
});

export function registerFileIpc(): void {
  // 打开文件（系统对话框）
  ipcMain.handle('file:open', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text', extensions: ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'css', 'html'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) return null;
      return await readFile(result.filePaths[0]);
    } catch (err) {
      console.error('[ipc] file:open error:', err);
      return null;
    }
  });

  // 通过路径打开
  ipcMain.handle('file:openPath', async (_e, filePath: string) => {
    try {
      return await readFile(filePath);
    } catch (err) {
      console.error('[ipc] file:openPath error:', err);
      throw err;
    }
  });

  // 保存
  ipcMain.handle(
    'file:save',
    async (_e, payload: { path: string; content: string }) => {
      try {
        await fsSync.writeFile(payload.path, payload.content, 'utf-8');
        return { ok: true };
      } catch (err) {
        console.error('[ipc] file:save error:', err);
        throw err;
      }
    },
  );

  // 另存为
  ipcMain.handle(
    'file:saveAs',
    async (event, payload: { content: string; defaultPath?: string }) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showSaveDialog(win!, {
          defaultPath: payload.defaultPath,
        });
        if (result.canceled || !result.filePath) return {};
        await fsSync.writeFile(result.filePath, payload.content, 'utf-8');
        return { path: result.filePath };
      } catch (err) {
        console.error('[ipc] file:saveAs error:', err);
        return {};
      }
    },
  );

  // 应用信息
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);
}

async function readFile(filePath: string) {
  const content = await fsSync.readFile(filePath, 'utf-8');
  const encoding = detectEncoding(content);
  return {
    path: filePath,
    name: path.basename(filePath),
    content,
    encoding,
  };
}

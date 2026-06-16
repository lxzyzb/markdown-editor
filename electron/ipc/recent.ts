import { app, ipcMain } from '../utils/electronModules';
import Store from 'electron-store';
import path from 'node:path';

interface RecentEntry {
  path: string;
  name: string;
  openedAt: number; // ms 时间戳
}

interface RecentSchema {
  items: RecentEntry[];
}

let store: Store<RecentSchema> | null = null;

function getStore(): Store<RecentSchema> {
  if (!store) {
    store = new Store<RecentSchema>({
      name: 'recent-files',
      cwd: app.getPath('userData'),
      defaults: { items: [] },
    });
    console.log('[recent] store path:', path.join(app.getPath('userData'), 'recent-files.json'));
  }
  return store;
}

const MAX_ITEMS = 200;

export function registerRecentIpc(): void {
  // 触发懒初始化（必须在 app.setPath 之后）
  getStore();

  ipcMain.handle('recent:list', () => getStore().get('items'));

  ipcMain.handle('recent:add', (_e, entry: RecentEntry) => {
    const s = getStore();
    const items = s.get('items').filter((it) => it.path !== entry.path);
    items.unshift({
      path: entry.path,
      name: entry.name,
      openedAt: entry.openedAt || Date.now(),
    });
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    s.set('items', items);
    return items;
  });

  ipcMain.handle('recent:remove', (_e: Electron.IpcMainInvokeEvent, paths: string[]) => {
    const s = getStore();
    const set = new Set(paths);
    const items = s.get('items').filter((it) => !set.has(it.path));
    s.set('items', items);
    return items;
  });

  ipcMain.handle('recent:clear', () => {
    const s = getStore();
    s.set('items', []);
    return [];
  });
}

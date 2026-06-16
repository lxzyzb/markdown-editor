import { create } from 'zustand';
import { detectLanguage } from '../utils/language';
import { useRecentStore } from './recentStore';

export interface Tab {
  id: string;
  path: string | null; // null 表示未保存的新文件
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export interface PendingReveal {
  tabId: string;
  startLine: number;
  endLine: number;
  ts: number;
}

interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  sidebarVisible: boolean;
  commandPaletteOpen: boolean;
  status: {
    line: number;
    column: number;
    language: string;
  };
  // 保存结果提示（用于状态栏反馈）
  lastSave: { ok: boolean; message: string; ts: number } | null;
  // 预览→源码跳转请求
  pendingReveal: PendingReveal | null;

  // 初始化
  init: () => void;
  // 标签操作
  openFile: (
    payload: { path: string; name: string; content: string },
    options?: { skipRecent?: boolean },
  ) => void;
  closeTab: (id: string) => boolean; // false 表示取消关闭
  setActiveTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  markSaved: (id: string) => void;
  renameTab: (id: string, payload: { path: string; name: string }) => void;
  // UI
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  setStatus: (status: Partial<EditorState['status']>) => void;
  // 预览跳转到源码
  requestReveal: (tabId: string, startLine: number, endLine: number) => void;
  consumePendingReveal: () => void;
  // 业务动作
  createNewTab: () => string;
  openFromDialog: () => Promise<void>;
  saveActive: () => Promise<boolean>;
  saveAsActive: () => Promise<boolean>;
}

let untitledCounter = 1;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sidebarVisible: true,
  commandPaletteOpen: false,
  status: { line: 1, column: 1, language: 'plaintext' },
  lastSave: null,
  pendingReveal: null,

  init: () => {
    // 后续接入 electron-store 恢复工作区
  },

  openFile: ({ path, name, content }, options) => {
    const skipRecent = options?.skipRecent === true;
    const existing = get().tabs.find((t) => t.path && t.path === path);
    if (existing) {
      set({ activeTabId: existing.id });
      // 标签已存在：刷新最近时间（拖入/对话框走默认 add 以触发重排）
      if (!skipRecent) {
        useRecentStore.getState().add({ path, name });
      }
      return;
    }
    const tab: Tab = {
      id: makeId(),
      path,
      name,
      content,
      isDirty: false,
      language: detectLanguage(name),
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
    // 自动记录到最近打开历史
    if (!skipRecent) {
      useRecentStore.getState().add({ path, name });
    }
  },

  closeTab: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return true;
    if (tab.isDirty) {
      const ok = window.confirm(
        `“${tab.name}” 有未保存的修改，确定要关闭吗？`,
      );
      if (!ok) return false;
    }
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === id);
      const tabs = state.tabs.filter((t) => t.id !== id);
      let activeTabId = state.activeTabId;
      if (activeTabId === id) {
        activeTabId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null;
      }
      return { tabs, activeTabId };
    });
    return true;
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, content, isDirty: true } : t,
      ),
    }));
  },

  markSaved: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, isDirty: false } : t)),
    }));
  },

  renameTab: (id, { path, name }) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, path, name, language: detectLanguage(name) } : t,
      ),
    }));
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setStatus: (status) => set((s) => ({ status: { ...s.status, ...status } })),

  createNewTab: () => {
    const name = `Untitled-${untitledCounter++}`;
    const tab: Tab = {
      id: makeId(),
      path: null,
      name,
      content: '',
      isDirty: false,
      language: 'plaintext',
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab.id;
  },

  requestReveal: (tabId, startLine, endLine) => {
    set({ pendingReveal: { tabId, startLine, endLine, ts: Date.now() } });
  },

  consumePendingReveal: () => set({ pendingReveal: null }),

  openFromDialog: async () => {
    const result = await window.electronAPI?.file.open();
    if (result) {
      get().openFile(result);
      // openFile 内部已自动记录到最近文件
    }
  },

  saveActive: async () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) {
      set({ lastSave: { ok: false, message: '没有可保存的标签', ts: Date.now() } });
      return false;
    }
    if (!tab.path) {
      return get().saveAsActive();
    }
    try {
      const res = await window.electronAPI?.file.save({ path: tab.path, content: tab.content });
      if (res?.ok) {
        get().markSaved(tab.id);
        // 保存成功：刷新最近历史时间，并使用最新文件名
        useRecentStore.getState().add({ path: tab.path, name: tab.name });
        set({ lastSave: { ok: true, message: `已保存：${tab.name}`, ts: Date.now() } });
        return true;
      }
      set({ lastSave: { ok: false, message: res?.error || '保存失败', ts: Date.now() } });
      return false;
    } catch (err) {
      console.error('saveActive error:', err);
      set({ lastSave: { ok: false, message: `保存失败：${String(err)}`, ts: Date.now() } });
      return false;
    }
  },

  saveAsActive: async () => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return false;
    try {
      const result = await window.electronAPI?.file.saveAs({
        content: tab.content,
        defaultPath: tab.name,
      });
      if (result?.path) {
        const name = result.path.split(/[\\/]/).pop() || tab.name;
        // 如果另存前已有旧路径，先从历史中移除旧条目
        if (tab.path && tab.path !== result.path) {
          useRecentStore.getState().remove([tab.path]);
        }
        get().renameTab(tab.id, { path: result.path, name });
        get().markSaved(tab.id);
        // 另存为成功：以新路径写入最近历史
        useRecentStore.getState().add({ path: result.path, name });
        set({ lastSave: { ok: true, message: `已保存到：${name}`, ts: Date.now() } });
        return true;
      }
      set({ lastSave: { ok: false, message: '已取消保存', ts: Date.now() } });
      return false;
    } catch (err) {
      console.error('saveAsActive error:', err);
      set({ lastSave: { ok: false, message: `另存为失败：${String(err)}`, ts: Date.now() } });
      return false;
    }
  },
}));

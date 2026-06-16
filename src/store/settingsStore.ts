import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveInterval: number; // 秒
  language: 'zh' | 'en';
  /** 左侧历史栏宽度（像素） */
  sidebarWidth: number;

  init: () => void;
  update: (patch: Partial<Omit<SettingsState, 'init' | 'update'>>) => void;
}

const defaultSettings: Omit<SettingsState, 'init' | 'update'> = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  autoSave: true,
  autoSaveInterval: 30,
  language: 'zh',
  sidebarWidth: 260,
};

const STORAGE_KEY = 'fileedit:settings:v1';

function loadPersisted(): Partial<typeof defaultSettings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // 忽略损坏的持久化数据
  }
  return {};
}

function persist(state: Partial<typeof defaultSettings>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败（隐私模式 / 配额耗尽）
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaultSettings,
  init: () => {
    const persisted = loadPersisted();
    if (Object.keys(persisted).length > 0) {
      set(persisted as Partial<SettingsState>);
    }
  },
  update: (patch) => {
    set(patch);
    // 持久化最新状态
    const next = { ...useSettingsStore.getState(), ...patch };
    const { init: _i, update: _u, ...persistable } = next;
    void _i;
    void _u;
    persist(persistable);
  },
}));

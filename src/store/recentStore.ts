import { create } from 'zustand';

export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
}

export type GroupKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'older';

interface RecentState {
  items: RecentEntry[];
  /** 是否处于多选模式 */
  multiSelect: boolean;
  /** 已选中项的 path 集合 */
  selected: Set<string>;
  /**
   * 排序版本号 — 显式递增信号。
   * 面板订阅此值来决定是否重新派生显示列表；
   * 数据更新（items 改变）但 sortVersion 不变时，面板保持原排序位置不变。
   */
  sortVersion: number;

  // 动作
  init: () => Promise<void>;
  /** 显式添加：写入存储并递增 sortVersion（用于拖入、对话框打开等） */
  add: (entry: Omit<RecentEntry, 'openedAt'>) => Promise<void>;
  /** 静默添加：写入存储但不递增 sortVersion（用于点击历史项，避免立即重排） */
  silentAdd: (entry: Omit<RecentEntry, 'openedAt'>) => Promise<void>;
  remove: (paths: string[]) => Promise<void>;
  clear: () => Promise<void>;
  /** 显式触发面板按最新数据重新派生（用于分组展开/折叠时） */
  forceResort: () => void;
  // 多选
  toggleMultiSelect: () => void;
  toggleSelect: (path: string) => void;
  clearSelection: () => void;
  selectAllInGroup: (paths: string[]) => void;
}

export const useRecentStore = create<RecentState>((set, get) => ({
  items: [],
  multiSelect: false,
  selected: new Set(),
  sortVersion: 0,

  init: async () => {
    const items = (await window.electronAPI?.recent.list()) ?? [];
    set((s) => ({ items, sortVersion: s.sortVersion + 1 }));
  },

  add: async (entry) => {
    const items = await window.electronAPI?.recent.add({
      ...entry,
      openedAt: Date.now(),
    });
    if (items) {
      set((s) => ({ items, sortVersion: s.sortVersion + 1 }));
    }
  },

  silentAdd: async (entry) => {
    const items = await window.electronAPI?.recent.add({
      ...entry,
      openedAt: Date.now(),
    });
    if (items) {
      // 注意：故意不递增 sortVersion，让面板保持原排序位置
      set({ items });
    }
  },

  remove: async (paths) => {
    if (paths.length === 0) return;
    const items = await window.electronAPI?.recent.remove(paths);
    if (items) {
      const next = new Set(get().selected);
      paths.forEach((p) => next.delete(p));
      set((s) => ({ items, selected: next, sortVersion: s.sortVersion + 1 }));
    }
  },

  clear: async () => {
    const items = await window.electronAPI?.recent.clear();
    set((s) => ({
      items,
      selected: new Set(),
      multiSelect: false,
      sortVersion: s.sortVersion + 1,
    }));
  },

  forceResort: () => {
    set((s) => ({ sortVersion: s.sortVersion + 1 }));
  },

  toggleMultiSelect: () => {
    set((s) => ({
      multiSelect: !s.multiSelect,
      selected: s.multiSelect ? new Set() : s.selected,
    }));
  },

  toggleSelect: (path) => {
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { selected: next };
    });
  },

  clearSelection: () => set({ selected: new Set() }),

  selectAllInGroup: (paths) => {
    set((s) => {
      const next = new Set(s.selected);
      const allSelected = paths.every((p) => s.selected.has(p));
      if (allSelected) paths.forEach((p) => next.delete(p));
      else paths.forEach((p) => next.add(p));
      return { selected: next };
    });
  },
}));

/**
 * 把列表按时间分组（按自然日 / 7 天 / 30 天 / 365 天 划分）
 * - today:     今天 00:00 之后
 * - yesterday: 昨天 00:00 ~ 今天 00:00
 * - week:      7 天内，但不属于 today / yesterday
 * - month:     30 天内，但不属于上面三组
 * - year:      365 天内，但不属于上面四组
 * - older:     更早
 */
export function groupRecent(items: RecentEntry[]): Record<GroupKey, RecentEntry[]> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 3600 * 1000;
  const day = 24 * 3600 * 1000;
  const nowMs = Date.now();
  const groups: Record<GroupKey, RecentEntry[]> = {
    today: [],
    yesterday: [],
    week: [],
    month: [],
    year: [],
    older: [],
  };
  for (const it of items) {
    if (it.openedAt >= startOfToday) {
      groups.today.push(it);
    } else if (it.openedAt >= startOfYesterday) {
      groups.yesterday.push(it);
    } else {
      const age = nowMs - it.openedAt;
      if (age <= 7 * day) groups.week.push(it);
      else if (age <= 30 * day) groups.month.push(it);
      else if (age <= 365 * day) groups.year.push(it);
      else groups.older.push(it);
    }
  }
  return groups;
}

export const GROUP_LABELS: Record<GroupKey, string> = {
  today: '今天',
  yesterday: '昨天',
  week: '本周',
  month: '一个月内',
  year: '一年内',
  older: '更早',
};

export const GROUP_ORDER: GroupKey[] = ['today', 'yesterday', 'week', 'month', 'year', 'older'];

import { useEffect, useState, useMemo } from 'react';
import {
  useRecentStore,
  groupRecent,
  GROUP_LABELS,
  GROUP_ORDER,
  type GroupKey,
  type RecentEntry,
} from '../../store/recentStore';
import { useEditorStore } from '../../store/editorStore';
import './recentPanel.css';

export default function RecentPanel() {
  // 关键：只订阅 sortVersion，不订阅 items。
  // 这样 silentAdd 写入了最新的 openedAt 时间戳但面板不重排，
  // 直至 forceResort / remove / clear / init 等显式触发才重新派生。
  const sortVersion = useRecentStore((s) => s.sortVersion);
  const init = useRecentStore((s) => s.init);
  const remove = useRecentStore((s) => s.remove);
  const clear = useRecentStore((s) => s.clear);
  const forceResort = useRecentStore((s) => s.forceResort);
  const multiSelect = useRecentStore((s) => s.multiSelect);
  const selected = useRecentStore((s) => s.selected);
  const toggleMultiSelect = useRecentStore((s) => s.toggleMultiSelect);
  const toggleSelect = useRecentStore((s) => s.toggleSelect);
  const clearSelection = useRecentStore((s) => s.clearSelection);

  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    today: false,
    week: false,
    month: false,
    year: false,
    older: false,
  });

  // 本地视图：随 sortVersion 变化从 store 重新派生
  const [view, setView] = useState<RecentEntry[]>(() =>
    useRecentStore.getState().items,
  );

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    setView(useRecentStore.getState().items);
  }, [sortVersion]);

  const groups = useMemo(() => groupRecent(view), [view]);

  const openFile = useEditorStore((s) => s.openFile);

  const handleClick = async (item: RecentEntry) => {
    if (multiSelect) {
      toggleSelect(item.path);
      return;
    }
    try {
      const result = await window.electronAPI?.file.openPath(item.path);
      if (result) {
        // 1) 打开标签（不通过 openFile 更新最近，避免重复 add）
        openFile(result, { skipRecent: true });
        // 2) 静默刷新该条目的 openedAt（不递增 sortVersion → 面板不重排）
        useRecentStore.getState().silentAdd({ path: item.path, name: item.name });
      }
    } catch (err) {
      console.error('openRecent error:', err);
      // 文件可能已被删除，提示并从列表移除
      window.alert(`无法打开：${item.name}\n文件可能已被移动或删除。`);
      await remove([item.path]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, item: RecentEntry) => {
    e.stopPropagation();
    await remove([item.path]);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selected.size} 条记录？`)) return;
    await remove(Array.from(selected));
    // 删除成功后自动取消多选
    clearSelection();
    toggleMultiSelect();
  };

  const handleClearAll = async () => {
    if (view.length === 0) return;
    if (!window.confirm('确定清空所有历史记录？此操作不可撤销。')) return;
    await clear();
    // 清空后已无记录，自动退出多选模式
    if (multiSelect) {
      toggleMultiSelect();
    }
  };

  const toggleGroup = (key: GroupKey) => {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
    // 显式触发按最新数据（含 silentAdd 后的时间戳）重新派生
    forceResort();
  };

  const totalCount = view.length;
  const groupCounts: Record<GroupKey, number> = {
    today: groups.today.length,
    yesterday: groups.yesterday.length,
    week: groups.week.length,
    month: groups.month.length,
    year: groups.year.length,
    older: groups.older.length,
  };

  return (
    <section className="recent-panel">
      <header className="recent-header">
        <span className="recent-title">最近文件</span>
        <span className="recent-count">{totalCount}</span>
        <div className="recent-header-actions">
          {multiSelect ? (
            <>
              <button onClick={clearSelection} title="取消选择">
                取消
              </button>
              <button
                className="danger"
                onClick={handleBatchDelete}
                disabled={selected.size === 0}
              >
                删除 ({selected.size})
              </button>
              <button onClick={toggleMultiSelect} title="退出多选">
                完成
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleMultiSelect} disabled={totalCount === 0} title="进入多选">
                多选
              </button>
              <button
                onClick={handleClearAll}
                disabled={totalCount === 0}
                title="清空全部"
                className="danger"
              >
                清空
              </button>
            </>
          )}
        </div>
      </header>

      <div className="recent-list">
        {totalCount === 0 ? (
          <div className="recent-empty">暂无打开记录</div>
        ) : (
          GROUP_ORDER.map((key) => {
            const list = groups[key];
            if (list.length === 0) return null;
            return (
              <Group
                key={key}
                label={GROUP_LABELS[key]}
                count={groupCounts[key]}
                collapsed={collapsed[key]}
                onToggle={() => toggleGroup(key)}
                items={list}
                multiSelect={multiSelect}
                selected={selected}
                onClick={handleClick}
                onDelete={handleDelete}
                onSelectAll={() =>
                  useRecentStore.getState().selectAllInGroup(list.map((it) => it.path))
                }
                toggleSelect={toggleSelect}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function Group({
  label,
  count,
  collapsed,
  onToggle,
  items,
  multiSelect,
  selected,
  onClick,
  onDelete,
  onSelectAll,
  toggleSelect,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  items: RecentEntry[];
  multiSelect: boolean;
  selected: Set<string>;
  onClick: (it: RecentEntry) => void;
  onDelete: (e: React.MouseEvent, it: RecentEntry) => void;
  onSelectAll: () => void;
  toggleSelect: (path: string) => void;
}) {
  const allSelected = items.every((it) => selected.has(it.path));
  return (
    <div className="recent-group">
      <div className="recent-group-header" onClick={onToggle}>
        <span className={`recent-group-caret ${collapsed ? '' : 'expanded'}`}>›</span>
        <span className="recent-group-label">{label}</span>
        <span className="recent-group-count">{count}</span>
        {multiSelect && (
          <button
            className="recent-group-select-all"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAll();
            }}
          >
            {allSelected ? '取消全选' : '全选'}
          </button>
        )}
      </div>
      {!collapsed && (
        <ul className="recent-group-items">
          {items.map((it) => (
            <li
              key={it.path}
              className={`recent-item ${multiSelect && selected.has(it.path) ? 'selected' : ''}`}
              onClick={() => onClick(it)}
              title={it.path}
            >
              {multiSelect && (
                <input
                  type="checkbox"
                  className="recent-item-checkbox"
                  checked={selected.has(it.path)}
                  onChange={() => toggleSelect(it.path)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <span className="recent-item-name">{it.name}</span>
              <span className="recent-item-time">
                {formatRelative(it.openedAt)}
              </span>
              {!multiSelect && (
                <button
                  className="recent-item-delete"
                  title="从历史中移除"
                  onClick={(e) => onDelete(e, it)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

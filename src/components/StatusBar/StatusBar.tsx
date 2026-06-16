import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore, type ThemeMode } from '../../store/settingsStore';
import './statusBar.css';

const THEME_CYCLE: ThemeMode[] = ['dark', 'light', 'system'];

const THEME_LABEL: Record<ThemeMode, string> = {
  dark: '暗夜',
  light: '普通',
  system: '跟随',
};

export default function StatusBar() {
  const status = useEditorStore((s) => s.status);
  const lastSave = useEditorStore((s) => s.lastSave);
  const activeId = useEditorStore((s) => s.activeTabId);
  const tab = useEditorStore((s) => s.tabs.find((t) => t.id === activeId));
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const updateSettings = useSettingsStore((s) => s.update);

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    updateSettings({ theme: next });
  };

  return (
    <div className="statusbar">
      {lastSave && (
        <span
          className={`statusbar-item statusbar-save ${lastSave.ok ? 'ok' : 'fail'}`}
          title={new Date(lastSave.ts).toLocaleTimeString()}
        >
          {lastSave.message}
        </span>
      )}
      <span className="statusbar-spacer" />
      <span className="statusbar-item">Ln {status.line}, Col {status.column}</span>
      <span className="statusbar-item">UTF-8</span>
      <span className="statusbar-item">LF</span>
      <span className="statusbar-item">{status.language}</span>
      {tab && (
        <span className="statusbar-item">
          {tab.isDirty ? '● 未保存' : '✓ 已保存'}
        </span>
      )}
      <span className="statusbar-item">{language.toUpperCase()}</span>
      <button
        className="statusbar-item statusbar-theme"
        onClick={cycleTheme}
        title="点击切换主题（暗夜 / 普通 / 跟随系统）"
        aria-label="切换主题"
      >
        <span className="statusbar-theme-icon" aria-hidden="true">
          {theme === 'light' ? '☀' : theme === 'system' ? '◐' : '☾'}
        </span>
        <span className="statusbar-theme-label">{THEME_LABEL[theme]}</span>
      </button>
    </div>
  );
}

import { useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useEffect, useRef, useState } from 'react';
import './commandPalette.css';

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette() {
  const open = useEditorStore((s) => s.commandPaletteOpen);
  const toggle = useEditorStore((s) => s.toggleCommandPalette);
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar);
  const updateSettings = useSettingsStore((s) => s.update);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'new', label: '文件: 新建文件', shortcut: 'Ctrl+N', action: () => {} },
    { id: 'open', label: '文件: 打开文件', shortcut: 'Ctrl+O', action: () => {} },
    { id: 'save', label: '文件: 保存', shortcut: 'Ctrl+S', action: () => {} },
    { id: 'toggleSidebar', label: '视图: 切换侧边栏', shortcut: 'Ctrl+B', action: toggleSidebar },
    { id: 'togglePalette', label: '视图: 打开命令面板', shortcut: 'Ctrl+Shift+P', action: toggle },
    { id: 'theme-dark', label: '主题: 切换为暗夜模式', action: () => updateSettings({ theme: 'dark' }) },
    { id: 'theme-light', label: '主题: 切换为普通模式', action: () => updateSettings({ theme: 'light' }) },
    { id: 'theme-system', label: '主题: 跟随系统', action: () => updateSettings({ theme: 'system' }) },
  ];

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape' && open) {
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, toggle]);

  if (!open) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="command-palette-mask" onClick={toggle}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入命令..."
        />
        <ul className="command-palette-list">
          {filtered.map((cmd) => (
            <li
              key={cmd.id}
              className="command-palette-item"
              onClick={() => {
                cmd.action();
                toggle();
              }}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <span className="command-palette-shortcut">{cmd.shortcut}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

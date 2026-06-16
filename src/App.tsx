import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import EditorArea from './components/EditorArea';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import DropOverlay from './components/DropOverlay';
import Resizer from './components/Resizer';
import { useEditorStore } from './store/editorStore';
import { useSettingsStore } from './store/settingsStore';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useTheme } from './hooks/useTheme';
import { useFileDrop } from './hooks/useFileDrop';
import type { CSSProperties } from 'react';

export default function App() {
  const initSettings = useSettingsStore((s) => s.init);
  const initEditor = useEditorStore((s) => s.init);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);

  useEffect(() => {
    initSettings();
    initEditor();
  }, [initSettings, initEditor]);

  // 应用主题
  useTheme();

  // 菜单事件 + 全局快捷键
  useMenuEvents();

  // 文件拖入支持
  const { isDragging } = useFileDrop();

  // 通过 CSS 变量下发 sidebar 宽度
  const bodyStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties;

  return (
    <div className="app">
      <div className="app-body" style={bodyStyle}>
        <Sidebar />
        <Resizer />
        <div className="app-main">
          <TabBar />
          <EditorArea />
          <StatusBar />
        </div>
      </div>
      <CommandPalette />
      <DropOverlay visible={isDragging} />
    </div>
  );
}

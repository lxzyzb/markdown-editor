import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * 监听主进程菜单事件 + 全局快捷键，转发到 store 动作
 */
export function useMenuEvents() {
  const createNewTab = useEditorStore((s) => s.createNewTab);
  const openFromDialog = useEditorStore((s) => s.openFromDialog);
  const saveActive = useEditorStore((s) => s.saveActive);
  const saveAsActive = useEditorStore((s) => s.saveAsActive);
  const toggleCommandPalette = useEditorStore((s) => s.toggleCommandPalette);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubs: Array<() => void> = [];

    unsubs.push(api.menu.onNewFile(() => createNewTab()));
    unsubs.push(api.menu.onOpenFile(() => openFromDialog()));
    unsubs.push(api.menu.onSaveFile(() => saveActive()));
    unsubs.push(api.menu.onSaveAs(() => saveAsActive()));
    unsubs.push(api.menu.onFind(() => toggleCommandPalette()));

    // 全局快捷键兜底（编辑器失焦时菜单也响应不到）
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) saveAsActive();
        else saveActive();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        createNewTab();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        openFromDialog();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener('keydown', onKey);
    };
  }, [createNewTab, openFromDialog, saveActive, saveAsActive, toggleCommandPalette]);
}

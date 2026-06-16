import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import './resizer.css';

interface Props {
  min?: number;
  max?: number;
}

/**
 * 垂直拖拽条：放在 Sidebar 与主内容之间，水平拖动以调整 sidebar 宽度。
 * - 宽度持久化到 settingsStore
 * - 全局监听 mousemove / mouseup，避免鼠标离开拖拽条后丢失事件
 * - 拖拽时给 body 加上 .resizer-dragging，统一改变光标与禁止文本选择
 */
export default function Resizer({ min = 180, max = 600 }: Props) {
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const update = useSettingsStore((s) => s.update);

  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - startXRef.current;
      const next = Math.min(
        max,
        Math.max(min, Math.round(startWidthRef.current + dx)),
      );
      update({ sidebarWidth: next });
    },
    [min, max, update],
  );

  const onMouseUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.classList.remove('resizer-dragging');
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    document.body.classList.add('resizer-dragging');
  };

  // 双击还原默认宽度
  const handleDoubleClick = () => {
    update({ sidebarWidth: 260 });
  };

  return (
    <div
      className="resizer"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={sidebarWidth}
      aria-valuemin={min}
      aria-valuemax={max}
      title="拖动调整宽度 · 双击还原"
    />
  );
}

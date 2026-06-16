import { useEffect, useState, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';

interface UseFileDropReturn {
  isDragging: boolean;
}

/**
 * 监听窗口级 drag-and-drop：把外部文件拖入时直接打开为标签。
 * 处理 dragenter/dragleave 的子元素冒泡（用计数器避免闪烁）。
 */
export function useFileDrop(): UseFileDropReturn {
  const openFile = useEditorStore((s) => s.openFile);
  const [isDragging, setIsDragging] = useState(false);

  // 用 ref 持有最新值，避免 useEffect 反复重绑
  const openFileRef = useRef(openFile);
  useEffect(() => {
    openFileRef.current = openFile;
  }, [openFile]);

  useEffect(() => {
    let counter = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counter++;
      if (counter === 1) setIsDragging(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counter = Math.max(0, counter - 1);
      if (counter === 0) setIsDragging(false);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      counter = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      void openDroppedFiles(files, openFileRef.current);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return { isDragging };
}

async function openDroppedFiles(
  files: File[],
  openFile: ReturnType<typeof useEditorStore.getState>['openFile'],
) {
  // Electron 30 中 File.path 仍可访问；非 Electron 环境无 path 跳过
  const paths = files
    .map((f) => (f as unknown as { path?: string }).path)
    .filter((p): p is string => typeof p === 'string' && p.length > 0);

  if (paths.length === 0) return;

  for (const filePath of paths) {
    try {
      const result = await window.electronAPI?.file.openPath(filePath);
      if (result) {
        openFile(result);
      }
    } catch (err) {
      console.error('[drop] openPath failed:', filePath, err);
    }
  }
}

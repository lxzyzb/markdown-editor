import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import './codeEditor.css';

interface Props {
  tabId: string;
  language: string;
  initialValue: string;
}

/**
 * 基于 Monaco 的代码编辑器封装
 * - 注册 Ctrl+S / Ctrl+Shift+S 触发 store 中的保存动作
 */
export default function CodeEditor({ tabId, language, initialValue }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const updateContent = useEditorStore((s) => s.updateContent);
  const setStatus = useEditorStore((s) => s.setStatus);
  const saveActive = useEditorStore((s) => s.saveActive);
  const saveAsActive = useEditorStore((s) => s.saveAsActive);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const theme = useSettingsStore((s) => s.theme);
  const pendingReveal = useEditorStore((s) => s.pendingReveal);
  const consumePendingReveal = useEditorStore((s) => s.consumePendingReveal);

  useEffect(() => {
    if (!containerRef.current) return;

    monaco.editor.defineTheme('fileedit-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
      },
    });

    monaco.editor.defineTheme('fileedit-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1a1d24',
      },
    });

    // 初始主题由外层 data-theme 决定
    const initialMonacoTheme = resolveMonacoTheme(theme);

    const editor = monaco.editor.create(containerRef.current, {
      value: initialValue,
      language,
      theme: initialMonacoTheme,
      fontSize,
      tabSize,
      wordWrap: wordWrap ? 'on' : 'off',
      minimap: { enabled: true },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
    });
    editorRef.current = editor;

    const sub = editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      updateContent(tabId, value);
    });

    const cursorSub = editor.onDidChangeCursorPosition((e) => {
      setStatus({
        line: e.position.lineNumber,
        column: e.position.column,
        language,
      });
    });

    // Ctrl+S / Ctrl+Shift+S 接管
    const saveBinding = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        saveActive();
      },
    );
    const saveAsBinding = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
      () => {
        saveAsActive();
      },
    );

    return () => {
      sub.dispose();
      cursorSub.dispose();
      try {
        // removeCommand 不在公开类型中，运行时通过 keybinding 服务清理
        (editor as any).removeCommand?.(saveBinding);
        (editor as any).removeCommand?.(saveAsBinding);
      } catch {
        // ignore
      }
      editor.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize, tabSize, wordWrap: wordWrap ? 'on' : 'off' });
  }, [fontSize, tabSize, wordWrap]);

  // 主题切换时同步 Monaco
  useEffect(() => {
    monaco.editor.setTheme(resolveMonacoTheme(theme));
  }, [theme]);

  // 预览→源码跳转：从 Markdown 块点击切换过来时，滚动并选中对应行范围
  useEffect(() => {
    if (!pendingReveal || pendingReveal.tabId !== tabId) return;

    let cancelled = false;
    let attempt = 0;
    const tryReveal = () => {
      if (cancelled) return;
      const editor = editorRef.current;
      if (!editor) {
        // 编辑器尚未就绪，帧循环重试
        if (attempt++ < 30) requestAnimationFrame(tryReveal);
        return;
      }
      const model = editor.getModel();
      if (!model) {
        if (attempt++ < 30) requestAnimationFrame(tryReveal);
        return;
      }
      const lineCount = model.getLineCount();
      const start = Math.max(1, Math.min(pendingReveal.startLine, lineCount));
      const end = Math.max(start, Math.min(pendingReveal.endLine, lineCount));
      const endCol = model.getLineMaxColumn(end);

      try {
        editor.revealLineInCenter(start);
        editor.setSelection({
          startLineNumber: start,
          startColumn: 1,
          endLineNumber: end,
          endColumn: endCol,
        });
        editor.focus();
        consumePendingReveal();
      } catch (err) {
        console.error('[CodeEditor] reveal failed:', err);
        consumePendingReveal();
      }
    };
    tryReveal();
    return () => { cancelled = true; };
  }, [pendingReveal, tabId, consumePendingReveal]);

  return <div ref={containerRef} className="monaco-container" />;
}

/**
 * 把 settingsStore.theme 映射到 Monaco 主题。
 * 解析 documentElement.dataset.theme 以处理 'system' 模式。
 */
function resolveMonacoTheme(theme: 'light' | 'dark' | 'system'): 'fileedit-dark' | 'fileedit-light' {
  if (theme === 'system') {
    const effective = document.documentElement.dataset.theme;
    return effective === 'light' ? 'fileedit-light' : 'fileedit-dark';
  }
  return theme === 'light' ? 'fileedit-light' : 'fileedit-dark';
}

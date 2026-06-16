import { useEditorStore } from '../../store/editorStore';
import CodeEditor from '../../editor/CodeEditor';
import MarkdownPreview from '../MarkdownPreview';
import { isMarkdownFile } from '../../utils/markdownBlocks';
import './editorArea.css';

export default function EditorArea() {
  const activeId = useEditorStore((s) => s.activeTabId);
  const tab = useEditorStore((s) => s.tabs.find((t) => t.id === activeId));

  if (!tab) {
    return (
      <div className="editor-area editor-area-empty">
        <div>
          <h2>欢迎使用 FileEdit</h2>
          <p>使用 Ctrl+O 打开文件，或将文件拖入窗口</p>
        </div>
      </div>
    );
  }

  // Markdown 始终以 HTML 渲染，点击块后仅该块变为源码编辑
  if (isMarkdownFile(tab.name)) {
    return (
      <div className="editor-area">
        <MarkdownPreview
          tabId={tab.id}
          content={tab.content}
          fileName={tab.name}
        />
      </div>
    );
  }

  return (
    <div className="editor-area">
      <CodeEditor
        tabId={tab.id}
        language={tab.language}
        initialValue={tab.content}
      />
    </div>
  );
}

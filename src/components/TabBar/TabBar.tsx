import { useEditorStore } from '../../store/editorStore';
import { isMarkdownFile } from '../../utils/markdownBlocks';
import './tabBar.css';

export default function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeId = useEditorStore((s) => s.activeTabId);
  const setActive = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (tabs.length === 0) {
    return (
      <div className="tabbar tabbar-empty">
        <span>未打开任何文件</span>
      </div>
    );
  }

  return (
    <div className="tabbar">
      <div className="tabbar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeId ? 'tab-active' : ''} ${
              isMarkdownFile(tab.name) ? 'tab-markdown' : ''
            }`}
            onClick={() => setActive(tab.id)}
            title={tab.path || tab.name}
          >
            <span className="tab-name">
              {tab.isDirty && <span className="tab-dirty">●</span>}
              {tab.name}
            </span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              title="关闭"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

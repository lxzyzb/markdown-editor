import './dropOverlay.css';

interface Props {
  visible: boolean;
}

export default function DropOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <div className="drop-overlay" aria-hidden="true">
      <div className="drop-overlay-card">
        <div className="drop-overlay-icon" aria-hidden="true">
          ⤓
        </div>
        <div className="drop-overlay-title">释放鼠标以打开</div>
        <div className="drop-overlay-hint">支持多文件 · 将作为新标签页打开</div>
      </div>
    </div>
  );
}

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useEditorStore } from '../../store/editorStore';
import {
  splitMarkdownBlocks,
  MdBlock,
  isMarkdownFile,
} from '../../utils/markdownBlocks';
import './markdownPreview.css';

marked.setOptions({
  gfm: true,
  breaks: false,
  async: false,
});

interface Props {
  tabId: string;
  content: string;
  fileName: string;
}

interface RenderedBlock extends MdBlock {
  html: string;
}

interface EditingTarget {
  blockIndex: number;
  lineIndex: number; // 0-based within block
  segmentIndex?: number; // undefined = 编辑整行；数字 = 编辑该行的某个片段
}

/* ==========================================================================
   行内 markdown 片段解析
   - 把一行 markdown 切成 "片段数组"
   - 片段分两种：text（普通文本） / 特殊符号包裹的（bold/italic/code/strikethrough）
   - 点击特殊符号片段 → 只编辑片段内部文字，提交时按原 delimiter 还原
   - 点击普通文本片段 → 编辑整行（保持原行为）
   ========================================================================== */
type InlineSegType = 'text' | 'bold' | 'italic' | 'code' | 'strikethrough';

interface InlineSegment {
  type: InlineSegType;
  start: number; // 在 line 中的起始下标（含 delimiter）
  end: number;   // 在 line 中的结束下标（不含）
  content: string; // 内部文字（不含 delimiter）
  raw: string;     // 原始 markdown 文本（含 delimiter）
  delimiter: string; // '' for text
}

function parseInlineSegments(line: string): InlineSegment[] {
  const segs: InlineSegment[] = [];
  const n = line.length;
  let i = 0;
  while (i < n) {
    // **...** 粗体（优先匹配，避免被 * 拆开）
    if (line.startsWith('**', i)) {
      const end = line.indexOf('**', i + 2);
      if (end > i + 2) {
        segs.push({
          type: 'bold', start: i, end: end + 2,
          content: line.slice(i + 2, end),
          raw: line.slice(i, end + 2),
          delimiter: '**',
        });
        i = end + 2;
        continue;
      }
    }
    // ~~...~~ 删除线
    if (line.startsWith('~~', i)) {
      const end = line.indexOf('~~', i + 2);
      if (end > i + 2) {
        segs.push({
          type: 'strikethrough', start: i, end: end + 2,
          content: line.slice(i + 2, end),
          raw: line.slice(i, end + 2),
          delimiter: '~~',
        });
        i = end + 2;
        continue;
      }
    }
    // *...* 斜体（单个 *，且不是 ** 的一部分）
    if (line[i] === '*' && line[i + 1] !== '*') {
      const end = line.indexOf('*', i + 1);
      if (end > i + 1) {
        segs.push({
          type: 'italic', start: i, end: end + 1,
          content: line.slice(i + 1, end),
          raw: line.slice(i, end + 1),
          delimiter: '*',
        });
        i = end + 1;
        continue;
      }
    }
    // `...` 行内代码
    if (line[i] === '`') {
      const end = line.indexOf('`', i + 1);
      if (end > i + 1) {
        segs.push({
          type: 'code', start: i, end: end + 1,
          content: line.slice(i + 1, end),
          raw: line.slice(i, end + 1),
          delimiter: '`',
        });
        i = end + 1;
        continue;
      }
    }
    // 普通文本：取到下一个可能的 delimiter 之前
    let j = i + 1;
    while (j < n && line[j] !== '*' && line[j] !== '`' && line[j] !== '~') j++;
    segs.push({
      type: 'text', start: i, end: j,
      content: line.slice(i, j),
      raw: line.slice(i, j),
      delimiter: '',
    });
    i = j;
  }
  return segs;
}

/** 代码块行的特殊渲染：不做任何 markdown 解析，原样转义显示 */
function renderCodeLineHtml(line: string): string {
  return `<code class="md-line-code">${escapeHtml(line)}</code>`;
}

/**
 * 整行用 marked.parse 渲染，产出正确的块级 HTML（h1-h6 / p / ul-li / blockquote / hr）。
 * 行内标签（strong/em/code/del）会在 click handler 里通过 e.target 识别，
 * 再回查 parseInlineSegments 找到对应片段下标，启动片段级编辑。
 */
function renderLineHtml(line: string): string {
  return marked.parse(line, { async: false }) as string;
}

/** HTML tag -> 片段类型 的映射（用于 click handler 回查片段） */
const TAG_TO_SEG: Record<string, InlineSegType> = {
  STRONG: 'bold',
  EM: 'italic',
  CODE: 'code',
  DEL: 'strikethrough',
};

/** 把一行 markdown 表格源行切成单元格数组（去首尾 |、按 | 切、trim） */
function parseTableCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

type CellAlign = 'left' | 'center' | 'right';

/** 从分隔行解析每列对齐方式：默认左对齐 */
function parseTableAligns(sepLine: string): CellAlign[] {
  const cells = parseTableCells(sepLine);
  return cells.map((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center' as const;
    if (right) return 'right' as const;
    return 'left' as const;
  });
}

/** HTML 转义：用于把代码块行内文本安全插入 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 行级编辑模型：
 * - 每个 block 拆成行（按 \n 切分），每行渲染为一个 .md-line 行
 * - 行默认展示该行的 HTML（marked 渲染一行 / 代码块用 <code>）
 * - 点击某行 → 该行切换为 <input>，显示该行 markdown 源码
 * - Enter / blur 提交（仅替换这一行），Esc 取消
 * - 点击区域样式与未编辑态完全一致：不动背景 / 边框 / 阴影
 */
export default function MarkdownPreview({ tabId, content, fileName }: Props) {
  const updateContent = useEditorStore((s) => s.updateContent);

  const blocks = useMemo<RenderedBlock[]>(() => {
    if (!isMarkdownFile(fileName)) return [];
    const parsed = splitMarkdownBlocks(content);
    return parsed.map((b) => ({
      ...b,
      html: marked.parse(b.raw, { async: false }) as string,
    }));
  }, [content, fileName]);

  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [draft, setDraft] = useState('');
  // 行编辑用 textarea（支持多行），片段编辑用 input，行内片段永远不会与行级 textarea 同时渲染
  const lineRef = useRef<HTMLTextAreaElement>(null);
  const segRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLInputElement>(null);

  // 进入编辑态：聚焦对应的输入元素；同时让 textarea 自适应到内容高度
  // 必须用 useLayoutEffect 而非 useEffect —— 后者在 paint 之后才跑，
  // 会导致浏览器先用 rows=1 的默认高度 paint 一次，再被改成 scrollHeight，
  // 那一帧的高度差就是用户看到的"上下抖动"（h2/h3 小字号下尤其明显）
  useLayoutEffect(() => {
    if (!editing) return;
    const target: HTMLElement | null =
      editing.segmentIndex !== undefined ? segRef.current : lineRef.current;
    if (target) {
      target.focus();
      if (target instanceof HTMLTextAreaElement) {
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
      }
    }
  }, [editing]);

  // draft 变化时同步 textarea 高度（用户换行 / 输入导致高度变化）
  useLayoutEffect(() => {
    if (editing && lineRef.current) {
      const el = lineRef.current;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft, editing]);

  const startEdit = (blockIndex: number, lineIndex: number, segmentIndex?: number) => {
    const block = blocks[blockIndex];
    if (!block) return;
    const lines = block.raw.split(/\r?\n/);
    const line = lines[lineIndex] ?? '';
    if (segmentIndex !== undefined) {
      // 片段编辑：draft = 完整 markdown 文本（含 delimiter），如 "**hello**"
      const segs = parseInlineSegments(line);
      const seg = segs[segmentIndex];
      setDraft(seg ? seg.raw : '');
    } else {
      // 整行编辑：draft = 整行 markdown
      setDraft(line);
    }
    setEditing({ blockIndex, lineIndex, segmentIndex });
  };

  const commitEdit = () => {
    if (!editing) return;
    const { blockIndex, lineIndex, segmentIndex } = editing;
    const block = blocks[blockIndex];
    if (!block) {
      setEditing(null);
      return;
    }
    const allLines = content.split(/\r?\n/);
    const targetIndex = block.startLine - 1 + lineIndex; // 0-based
    const oldLine = allLines[targetIndex];
    if (oldLine === undefined) {
      setEditing(null);
      return;
    }

    let newLines: string[];
    if (segmentIndex !== undefined) {
      // 片段编辑：draft 已是完整 markdown，直接按 [start, end) 替换回原行
      const segs = parseInlineSegments(oldLine);
      const seg = segs[segmentIndex];
      if (!seg) { setEditing(null); return; }
      if (draft === seg.raw) { setEditing(null); return; }
      newLines = [oldLine.slice(0, seg.start) + draft + oldLine.slice(seg.end)];
    } else {
      // 整行编辑：draft 可能包含多行（textarea 中 Shift+Enter 换行）
      newLines = draft.split(/\r?\n/);
      if (newLines.length === 1 && newLines[0] === oldLine) {
        setEditing(null);
        return;
      }
    }

    // 替换对应位置的 1 行 / N 行
    allLines.splice(targetIndex, 1, ...newLines);
    setEditing(null);
    updateContent(tabId, allLines.join('\n'));
  };

  const cancelEdit = () => setEditing(null);

  /** 表格行专用提交：直接用传入的新行字符串替换 content 中对应行 */
  const commitRowEdit = (blockIndex: number, lineIndex: number, newLine: string) => {
    const block = blocks[blockIndex];
    if (!block) {
      setEditing(null);
      return;
    }
    const allLines = content.split(/\r?\n/);
    const targetIndex = block.startLine - 1 + lineIndex;
    if (allLines[targetIndex] === newLine) {
      setEditing(null);
      return;
    }
    allLines[targetIndex] = newLine;
    setEditing(null);
    updateContent(tabId, allLines.join('\n'));
  };

  if (blocks.length === 0) {
    return (
      <div className="md-preview md-preview-empty">
        <p>暂无内容</p>
      </div>
    );
  }

  return (
    <div className="md-preview" role="document">
      {blocks.map((b, blockIndex) => {
        if (b.type === 'table') {
          return (
            <TableBlock
              key={`${b.startLine}-${blockIndex}`}
              block={b}
              blockIndex={blockIndex}
              editing={editing}
              inputRef={tableRef}
              onStartEdit={startEdit}
              onCommitRow={commitRowEdit}
              onCancel={cancelEdit}
            />
          );
        }

        const lines = b.raw.split(/\r?\n/);
        // 标题块：识别 1~6 级，附加 md-block-h{n} class，供 input 字号匹配
        const headingLevel =
          b.type === 'heading'
            ? Math.min(6, (b.raw.match(/^\s{0,3}(#{1,6})\s/) || [])[1]?.length || 1)
            : 0;
        const blockClass = `md-block md-block-${b.type}${
          headingLevel ? ` md-block-h${headingLevel}` : ''
        }`;
        return (
          <div
            key={`${b.startLine}-${blockIndex}`}
            className={blockClass}
            data-source-start={b.startLine}
            data-source-end={b.endLine}
          >
            {lines.map((line, lineIndex) => {
              const absoluteLine = b.startLine + lineIndex;
              const isLineEditing =
                editing?.blockIndex === blockIndex &&
                editing?.lineIndex === lineIndex &&
                editing?.segmentIndex === undefined;

              const isSegEditing =
                editing?.blockIndex === blockIndex &&
                editing?.lineIndex === lineIndex &&
                editing?.segmentIndex !== undefined;

              // 提前解析行内片段，供 click handler 回查片段下标
              const segments = b.type === 'code' ? [] : parseInlineSegments(line);

              // 点击行内 strong/em/code/del → 片段编辑；否则整行编辑
              const handleLineClick = (e: React.MouseEvent) => {
                if (isLineEditing) return;
                const target = e.target as HTMLElement;
                if (b.type === 'code') {
                  startEdit(blockIndex, lineIndex);
                  return;
                }
                if (b.type === 'hr') return; // hr 不可编辑
                // 向上找最近的 strong/em/code/del
                let node: HTMLElement | null = target;
                while (node && node !== e.currentTarget) {
                  const segType = TAG_TO_SEG[node.tagName];
                  if (segType) {
                    // 排除 <pre> 里的 <code>（代码块行内的高亮 token）
                    if (node.tagName === 'CODE' && node.parentElement?.tagName === 'PRE') {
                      break;
                    }
                    const text = node.textContent ?? '';
                    // 优先按 textContent 完全匹配定位片段下标
                    let segIndex = segments.findIndex(
                      (s) => s.type === segType && s.content === text,
                    );
                    // 退化：按类型 + 出现顺序匹配
                    if (segIndex === -1) {
                      let nth = 0;
                      for (let i = 0; i < segments.length; i++) {
                        if (segments[i].type === segType) {
                          if (nth === 0) { segIndex = i; break; }
                          nth--;
                        }
                      }
                    }
                    if (segIndex !== -1) {
                      e.stopPropagation();
                      startEdit(blockIndex, lineIndex, segIndex);
                      return;
                    }
                    break;
                  }
                  node = node.parentElement;
                }
                startEdit(blockIndex, lineIndex);
              };

              // hr 块只渲染一条分隔线
              if (b.type === 'hr') {
                return (
                  <div
                    key={lineIndex}
                    className="md-line md-line-hr"
                    data-line={absoluteLine}
                  >
                    <hr className="md-line-hr-rule" />
                  </div>
                );
              }

              return (
                <div
                  key={lineIndex}
                  className={`md-line ${isLineEditing ? 'md-line-editing' : ''}`}
                  onClick={handleLineClick}
                  data-line={absoluteLine}
                  title="点击编辑此行"
                >
                  {isLineEditing ? (
                    <textarea
                      ref={lineRef}
                      className="md-line-input md-line-textarea"
                      value={draft}
                      rows={1}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        // Enter 提交；Shift+Enter 插入换行（保留多行结构）
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          commitEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                    />
                  ) : isSegEditing ? (
                    // 片段编辑：编辑中的片段显示 input，其它片段用 parseInline 渲染
                    <>
                      {segments.map((seg, segIndex) => {
                        if (segIndex === editing!.segmentIndex) {
                          return (
                            <span
                              key={segIndex}
                              className={`md-segment md-segment-${seg.type} md-segment-editing`}
                            >
                              <input
                                ref={segRef}
                                className="md-line-input md-segment-input"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitEdit}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                                  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                                }}
                              />
                            </span>
                          );
                        }
                        return (
                          <span
                            key={segIndex}
                            className={`md-segment md-segment-${seg.type}`}
                            dangerouslySetInnerHTML={{
                              __html: marked.parseInline(seg.raw, { async: false }) as string,
                            }}
                          />
                        );
                      })}
                    </>
                  ) : b.type === 'code' ? (
                    // 代码块行：原样转义
                    <div
                      className="md-line-html"
                      dangerouslySetInnerHTML={{ __html: renderCodeLineHtml(line) }}
                    />
                  ) : (
                    // 普通块行：用 marked.parse 产出正确的块级 HTML（h1-h6 / p / ul-li / blockquote）
                    // 必须用 <div> 而不是 <span>，否则内联元素包块级元素会触发浏览器 tag soup 修复，
                    // 把 <p>/<ul>/<h1> 强制移到 span 之外，导致高度/布局在编辑态和显示态不一致，
                    // 出现两行编辑时合并的视觉问题。
                    <div
                      className="md-line-html"
                      dangerouslySetInnerHTML={{ __html: renderLineHtml(line) }}
                    />
                  )}
                  <span className="md-line-gutter" aria-hidden="true">
                    L{absoluteLine}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   表格块：单独渲染为真 HTML 表格
   - thead / tbody / tr / th / td，浏览器自动对齐列宽
   - 每一行（表头 / 数据行）可点击编辑，编辑时整行合并为单格 <input>
   - 分隔行（| --- | ...）在源里保留，但不渲染、不可点
   ========================================================================== */
interface TableBlockProps {
  block: RenderedBlock;
  blockIndex: number;
  editing: EditingTarget | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onStartEdit: (blockIndex: number, lineIndex: number) => void;
  onCommitRow: (blockIndex: number, lineIndex: number, newLine: string) => void;
  onCancel: () => void;
}

function TableBlock({
  block,
  blockIndex,
  editing,
  inputRef,
  onStartEdit,
  onCommitRow,
  onCancel,
}: TableBlockProps) {
  // 每格独立 draft：key 是 "lineIndex:cellIndex"，进入编辑时初始化
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const lastInitKeyRef = useRef<string>('');

  const allLines = block.raw.split(/\r?\n/);
  // 至少需要表头 + 分隔行
  if (allLines.length < 2) {
    return (
      <div
        className="md-block md-block-table md-block-table-empty"
        data-source-start={block.startLine}
        data-source-end={block.endLine}
      >
        <em>无效的表格</em>
      </div>
    );
  }
  const headerLine = allLines[0];
  const sepLine = allLines[1];
  const headerCells = parseTableCells(headerLine);
  const aligns = parseTableAligns(sepLine);
  const dataLines = allLines.slice(2); // 跳过表头与分隔行
  const colCount = headerCells.length;
  // 对齐数组补齐到列数
  while (aligns.length < colCount) aligns.push('left');

  const isEditingRow = (lineIndex: number) =>
    editing?.blockIndex === blockIndex && editing?.lineIndex === lineIndex;

  /** 进入编辑时，把该行各 cell 初始化到 cellDrafts（仅一次） */
  const ensureDraftsForRow = (lineIndex: number) => {
    const key = `${lineIndex}`;
    if (lastInitKeyRef.current === key) return;
    const line = allLines[lineIndex] || '';
    const cells = parseTableCells(line);
    const next: Record<string, string> = { ...cellDrafts };
    cells.forEach((c, i) => {
      next[`${lineIndex}:${i}`] = c;
    });
    setCellDrafts(next);
    lastInitKeyRef.current = key;
  };

  const startRowEdit = (lineIndex: number) => {
    ensureDraftsForRow(lineIndex);
    onStartEdit(blockIndex, lineIndex);
  };

  const setCellDraft = (lineIndex: number, cellIndex: number, v: string) => {
    setCellDrafts((prev) => ({ ...prev, [`${lineIndex}:${cellIndex}`]: v }));
  };

  const commitRow = (lineIndex: number) => {
    const cells = parseTableCells(allLines[lineIndex] || '');
    const values = cells.map((_, i) => cellDrafts[`${lineIndex}:${i}`] ?? '');
    const newLine = `| ${values.join(' | ')} |`;
    onCommitRow(blockIndex, lineIndex, newLine);
  };

  const renderRow = (line: string, lineIndex: number, isHeader: boolean) => {
    const rowEditing = isEditingRow(lineIndex);
    const Tag = isHeader ? 'th' : 'td';
    const cells = parseTableCells(line);
    return (
      <tr
        key={lineIndex}
        className={`md-line md-line-table-row ${rowEditing ? 'md-line-editing' : ''}`}
        onClick={() => !rowEditing && startRowEdit(lineIndex)}
        data-line={block.startLine + lineIndex}
        title="点击编辑此行"
      >
        {rowEditing
          ? cells.map((_, i) => {
              const a = aligns[i] || 'left';
              const isFirst = i === 0;
              return (
                <td
                  key={i}
                  className={`md-line-table-cell-editing md-table-cell-${a}`}
                  style={{ textAlign: a, padding: 0 }}
                >
                  <input
                    ref={isFirst ? inputRef : undefined}
                    className="md-line-input"
                    value={cellDrafts[`${lineIndex}:${i}`] ?? ''}
                    onChange={(e) => setCellDraft(lineIndex, i, e.target.value)}
                    onBlur={() => commitRow(lineIndex)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRow(lineIndex);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                      }
                    }}
                  />
                </td>
              );
            })
          : cells.map((cell, i) => {
              const a = aligns[i] || 'left';
              return (
                <Tag
                  key={i}
                  className={`md-table-cell md-table-cell-${a}`}
                  style={{ textAlign: a }}
                >
                  {cell}
                </Tag>
              );
            })}
      </tr>
    );
  };

  return (
    <div
      className="md-block md-block-table"
      data-source-start={block.startLine}
      data-source-end={block.endLine}
    >
      <table className="md-table">
        <thead>{renderRow(headerLine, 0, true)}</thead>
        <tbody>
          {dataLines.map((line, i) => renderRow(line, i + 2, false))}
        </tbody>
      </table>
    </div>
  );
}

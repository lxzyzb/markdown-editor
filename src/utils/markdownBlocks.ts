/**
 * 简易 Markdown 块切分器：为每个块记录起止行号，供预览→源码跳转使用。
 * 不追求 100% CommonMark，覆盖最常见的 7 种块类型。
 */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'code'
  | 'list'
  | 'blockquote'
  | 'hr'
  | 'table'
  | 'html';

export interface MdBlock {
  type: BlockType;
  startLine: number; // 1-based inclusive
  endLine: number;   // 1-based inclusive
  raw: string;
}

const isBlank = (s: string) => /^\s*$/.test(s);
const isHeading = (s: string) => /^\s{0,3}#{1,6}\s+\S/.test(s);
const isHr = (s: string) => /^\s{0,3}([-*_])\s*\1\s*\1[-*_\s]*$/.test(s);
const isBlockquote = (s: string) => /^\s{0,3}>/.test(s);
const isList = (s: string) => /^\s{0,3}([-+*]|\d+\.)\s+/.test(s);

// GFM 表格：包含至少一个 |
const isTableRow = (s: string) => /\|/.test(s);
// GFM 表格分隔行：| --- | :---: | ---: | 之类
const isTableSeparator = (s: string) => {
  const t = s.trim();
  if (!t) return false;
  let body = t;
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|')) body = body.slice(0, -1);
  if (!body) return false;
  return body
    .split('|')
    .every((cell) => /^[\s:-]+$/.test(cell) && /-/.test(cell));
};

function fenceMarker(line: string): string | null {
  const m = line.match(/^\s{0,3}(```+|~~~+)/);
  return m ? m[1] : null;
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

export function splitMarkdownBlocks(content: string): MdBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isBlank(lines[i])) {
      i++;
      continue;
    }

    const start = i;

    // 代码围栏
    const fence = fenceMarker(lines[i]);
    if (fence) {
      i++;
      while (i < lines.length) {
        if (fenceMarker(lines[i])?.startsWith(fence[0]) &&
            fenceMarker(lines[i])!.length >= fence.length) {
          i++;
          break;
        }
        i++;
      }
      blocks.push({ type: 'code', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 标题
    if (isHeading(lines[i])) {
      i++;
      blocks.push({ type: 'heading', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 表格：要求"当前行是表头 + 下一行是分隔行"；之后吃掉所有 pipe 行
    if (
      i + 1 < lines.length &&
      isTableRow(lines[i]) &&
      isTableSeparator(lines[i + 1])
    ) {
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) i++;
      blocks.push({ type: 'table', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 水平线
    if (isHr(lines[i])) {
      i++;
      blocks.push({ type: 'hr', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 引用块
    if (isBlockquote(lines[i])) {
      while (i < lines.length) {
        if (isBlockquote(lines[i])) { i++; continue; }
        if (isBlank(lines[i]) && i + 1 < lines.length && isBlockquote(lines[i + 1])) { i++; continue; }
        break;
      }
      blocks.push({ type: 'blockquote', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 列表
    if (isList(lines[i])) {
      const baseIndent = indentOf(lines[i]);
      while (i < lines.length) {
        if (!isBlank(lines[i])) { i++; continue; }
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j >= lines.length) break;
        if (isList(lines[j]) || indentOf(lines[j]) > baseIndent) {
          i = j;
          continue;
        }
        break;
      }
      blocks.push({ type: 'list', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
      continue;
    }

    // 段落（兜底）
    while (i < lines.length && !isBlank(lines[i])) i++;
    blocks.push({ type: 'paragraph', startLine: start + 1, endLine: i, raw: lines.slice(start, i).join('\n') });
  }

  return blocks;
}

export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown|mdown|mkd|mdx)$/i.test(name);
}

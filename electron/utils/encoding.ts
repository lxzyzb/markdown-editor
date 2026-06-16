/**
 * 文件编码检测（简单实现，后续可替换为 jschardet 等）
 */
export function detectEncoding(_content: string): string {
  // 简化处理，默认 UTF-8
  // 真实场景可读取 BOM 头做判断
  return 'utf-8';
}

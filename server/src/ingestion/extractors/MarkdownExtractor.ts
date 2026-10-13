import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { parse as parseYaml } from 'yaml';
import type { Root, RootContent, Heading } from 'mdast';
import { ExtractionError, type Extractor, type ExtractionResult } from './Extractor.js';
import { decodeUtf8, normalizeText, textStats } from './normalize.js';

const parser = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm);

type AnyNode = Root | RootContent;

/**
 * Markdown -> plain text. Syntax is removed; content is kept:
 *  - headings/paragraphs/lists/quotes -> lines of text (no markers)
 *  - code blocks and inline code      -> kept verbatim (code IS knowledge)
 *  - links                            -> link text; images -> alt text
 *  - raw HTML, thematic breaks        -> dropped
 *  - YAML frontmatter                 -> moved to metadata, not mixed into the text
 * Heading structure is preserved in metadata for future structure-aware chunking.
 */
export class MarkdownExtractor implements Extractor {
  async extract(raw: Buffer): Promise<ExtractionResult> {
    const source = decodeUtf8(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const tree = parser.parse(source) as Root;

    const headings: { depth: number; text: string }[] = [];
    let frontmatter: Record<string, unknown> | null = null;
    let frontmatterError: string | undefined;

    const render = (node: AnyNode): string => {
      switch (node.type) {
        case 'yaml':
          try {
            const parsed = parseYaml(node.value);
            frontmatter = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
          } catch (e) {
            frontmatterError = (e as Error).message.split('\n')[0];
          }
          return '';
        case 'html':
        case 'thematicBreak':
        case 'definition':
          return '';
        case 'code':
        case 'inlineCode':
        case 'text':
          return node.value;
        case 'image':
          return node.alt ?? '';
        case 'break':
          return '\n';
        case 'heading': {
          const text = inline(node);
          headings.push({ depth: (node as Heading).depth, text });
          return text;
        }
        case 'table':
          return node.children.map((row) => row.children.map((c) => inline(c)).join(' | ')).join('\n');
        case 'list':
          return node.children.map((item) => blocks(item.children, '\n')).join('\n');
        default:
          if ('children' in node) {
            const kids = node.children as AnyNode[];
            return kids.some(isBlock) ? blocks(kids, '\n\n') : kids.map(render).join('');
          }
          return 'value' in node && typeof node.value === 'string' ? node.value : '';
      }
    };
    const inline = (node: AnyNode): string => ('children' in node ? (node.children as AnyNode[]).map(render).join('') : render(node));
    const blocks = (nodes: AnyNode[], sep: string): string => nodes.map(render).filter((s) => s !== '').join(sep);

    const text = normalizeText(blocks(tree.children, '\n\n'));
    if (!text) throw new ExtractionError('Markdown contains no extractable text', 'EMPTY_CONTENT');

    const fm = frontmatter as Record<string, unknown> | null;
    const fmTitle = fm && typeof fm.title === 'string' ? fm.title : undefined;
    const h1 = headings.find((h) => h.depth === 1)?.text;
    return {
      text,
      method: 'markdown-mdast-v1',
      metadata: {
        title: fmTitle ?? h1 ?? null,
        headings,
        frontmatter,
        ...(frontmatterError ? { frontmatterError } : {}),
        ...textStats(text),
      },
    };
  }
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'list', 'code', 'blockquote', 'table', 'html', 'thematicBreak', 'yaml']);
function isBlock(n: AnyNode): boolean {
  return BLOCK_TYPES.has(n.type);
}

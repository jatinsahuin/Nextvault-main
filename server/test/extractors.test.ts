import { describe, expect, it } from 'vitest';
import { MarkdownExtractor } from '../src/ingestion/extractors/MarkdownExtractor.js';
import { TextExtractor } from '../src/ingestion/extractors/TextExtractor.js';
import { ExtractorFactory } from '../src/ingestion/extractors/ExtractorFactory.js';

const md = (s: string) => new MarkdownExtractor().extract(Buffer.from(s));

describe('MarkdownExtractor', () => {
  it('strips syntax but keeps content, code and structure metadata', async () => {
    const r = await md('# Title\n\nSome **bold** and [a link](http://x.y) and ![alt text](i.png).\n\n```js\nconst a = 1;\n```\n');
    expect(r.text).toBe('Title\n\nSome bold and a link and alt text.\n\nconst a = 1;');
    expect(r.metadata.title).toBe('Title');
    expect(r.method).toBe('markdown-mdast-v1');
  });
  it('drops raw HTML and moves frontmatter into metadata', async () => {
    const r = await md('---\ntitle: FM\n---\n\n<div>x</div>\n\nbody');
    expect(r.text).toBe('body');
    expect(r.metadata.title).toBe('FM');
  });
  it('survives malformed frontmatter', async () => {
    const r = await md('---\nfoo: [unclosed\n---\n\nbody');
    expect(r.text).toBe('body');
    expect(r.metadata.frontmatterError).toBeTruthy();
  });
  it('handles BOM and CRLF', async () => {
    const r = await new MarkdownExtractor().extract(Buffer.from('\uFEFF# Hi\r\n\r\nthere\r\n'));
    expect(r.text).toBe('Hi\n\nthere');
  });
  it('rejects empty/markup-only content', async () => {
    await expect(md('<!-- nothing -->')).rejects.toMatchObject({ code: 'EMPTY_CONTENT' });
  });
});

describe('TextExtractor', () => {
  it('normalizes whitespace without touching inner indentation', async () => {
    const r = await new TextExtractor().extract(Buffer.from('a  \r\n\r\n\r\n\r\n    indented\r\n'));
    expect(r.text).toBe('a\n\n    indented'.trim());
  });
  it('rejects invalid UTF-8 and binary', async () => {
    await expect(new TextExtractor().extract(Buffer.from([0xff, 0xfe, 0x00, 0x80]))).rejects.toMatchObject({ code: 'INVALID_ENCODING' });
    await expect(new TextExtractor().extract(Buffer.from('ab\u0000cd'))).rejects.toMatchObject({ code: 'BINARY_CONTENT' });
  });
});

describe('ExtractorFactory', () => {
  it('rejects unknown types', () => {
    expect(() => new ExtractorFactory().forMime('application/pdf')).toThrow();
  });
});

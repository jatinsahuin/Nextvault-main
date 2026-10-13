import type { Extractor } from './Extractor.js';
import { ExtractionError } from './Extractor.js';
import { TextExtractor } from './TextExtractor.js';
import { MarkdownExtractor } from './MarkdownExtractor.js';

export type SourceKind = 'text' | 'markdown';

/** Single source of truth for supported types: extension -> kind + canonical MIME. */
export const SUPPORTED_TYPES: Record<string, { kind: SourceKind; mime: string }> = {
  '.txt': { kind: 'text', mime: 'text/plain' },
  '.md': { kind: 'markdown', mime: 'text/markdown' },
};

export class ExtractorFactory {
  private readonly text = new TextExtractor();
  private readonly markdown = new MarkdownExtractor();

  /** Routes on the canonical MIME stored on the source (never on user-supplied filenames). */
  forMime(mime: string): Extractor {
    switch (mime) {
      case 'text/plain': return this.text;
      case 'text/markdown': return this.markdown;
      default: throw new ExtractionError(`No extractor for ${mime}`, 'UNSUPPORTED_TYPE');
    }
  }
}

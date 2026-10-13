import { ExtractionError, type Extractor, type ExtractionResult } from './Extractor.js';
import { decodeUtf8, normalizeText, textStats } from './normalize.js';

export class TextExtractor implements Extractor {
  async extract(raw: Buffer): Promise<ExtractionResult> {
    const text = normalizeText(decodeUtf8(raw));
    if (!text) throw new ExtractionError('File contains no extractable text', 'EMPTY_CONTENT');
    return { text, metadata: textStats(text), method: 'text-utf8-v1' };
  }
}

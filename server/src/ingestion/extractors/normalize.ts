import { ExtractionError } from './Extractor.js';

/** Strict UTF-8 decode. Invalid bytes or NULs mean this is not text we can trust. */
export function decodeUtf8(raw: Buffer): string {
  let s: string;
  try {
    s = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(raw);
  } catch {
    throw new ExtractionError('File is not valid UTF-8 text', 'INVALID_ENCODING');
  }
  if (s.includes('\u0000')) throw new ExtractionError('File contains NUL bytes (binary?)', 'BINARY_CONTENT');
  return s;
}

/**
 * Canonical text form. Fixes representation only (BOM, line endings, unicode form,
 * control chars, trailing whitespace, blank-line runs). It never touches inner spacing,
 * so indented code and poetry survive.
 */
export function normalizeText(input: string): string {
  return input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textStats(text: string) {
  return {
    charCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    lineCount: text === '' ? 0 : text.split('\n').length,
  };
}

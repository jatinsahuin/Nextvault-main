export class Extractor {
    async extract(fileBuffer) {
        throw new Error('Method extract() must be implemented');
    }
}

export class TextExtractor extends Extractor {
    async extract(fileBuffer) {
        const text = fileBuffer.toString('utf8');
        return {
            content: text,
            language: 'en',
            structure: { type: 'plain-text' }
        };
    }
}

export class MarkdownExtractor extends Extractor {
    async extract(fileBuffer) {
        const text = fileBuffer.toString('utf8');
        return {
            content: text,
            language: 'en',
            structure: { type: 'markdown' }
        };
    }
}

export class ExtractorFactory {
    static getExtractor(mimeType) {
        switch (mimeType) {
            case 'text/plain':
                return new TextExtractor();
            case 'text/markdown':
            case 'text/x-markdown':
                return new MarkdownExtractor();
            default:
                throw new Error(`Unsupported MIME type: ${mimeType}`);
        }
    }
}

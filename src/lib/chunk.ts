export type TextChunk = {
  id: string;
  index: number;
  text: string;
  page?: number;
};

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

function splitIntoChunks(text: string, options: ChunkOptions): string[] {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  const chunkSize = options.chunkSize ?? 800;
  const overlap = options.overlap ?? 120;

  if (!normalizedText) {
    return [];
  }

  const pieces: string[] = [];
  let start = 0;

  while (start < normalizedText.length) {
    let end = Math.min(start + chunkSize, normalizedText.length);

    if (end < normalizedText.length) {
      const nextBreak = normalizedText.lastIndexOf("\n", end);

      if (nextBreak > start + Math.floor(chunkSize * 0.6)) {
        end = nextBreak;
      }
    }

    const piece = normalizedText.slice(start, end).trim();

    if (piece) {
      pieces.push(piece);
    }

    if (end >= normalizedText.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return pieces;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): TextChunk[] {
  return splitIntoChunks(text, options).map((piece, index) => ({
    id: `chunk-${index}`,
    index,
    text: piece,
  }));
}

export type TextPage = {
  page: number;
  text: string;
};

/**
 * Chunk page-by-page so each chunk can carry its source page number through to citations.
 */
export function chunkPages(
  pages: TextPage[],
  options: ChunkOptions = {},
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let index = 0;

  for (const { page, text } of pages) {
    for (const piece of splitIntoChunks(text, options)) {
      chunks.push({
        id: `chunk-${index}`,
        index,
        text: piece,
        page,
      });
      index += 1;
    }
  }

  return chunks;
}

export type TextChunk = {
  id: string;
  index: number;
  text: string;
};

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const normalizedText = text.replace(/\r\n/g, "\n").trim();
  const chunkSize = options.chunkSize ?? 800;
  const overlap = options.overlap ?? 120;

  if (!normalizedText) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalizedText.length) {
    let end = Math.min(start + chunkSize, normalizedText.length);

    if (end < normalizedText.length) {
      const nextBreak = normalizedText.lastIndexOf("\n", end);

      if (nextBreak > start + Math.floor(chunkSize * 0.6)) {
        end = nextBreak;
      }
    }

    const chunkTextValue = normalizedText.slice(start, end).trim();

    if (chunkTextValue) {
      chunks.push({
        id: `chunk-${index}`,
        index,
        text: chunkTextValue,
      });
      index += 1;
    }

    if (end >= normalizedText.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

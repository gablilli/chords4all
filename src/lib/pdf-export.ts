type DownloadPdfOptions = {
  title: string;
  artist: string;
  body: string;
  semitones: number;
  simplify: boolean;
  fontSize: number;
};

const encoder = new TextEncoder();
const MAX_CHARS_PER_LINE = 95;
const MAX_LINES_PER_PAGE = 56;

function normalizePunctuation(input: string): string {
  return input
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ');
}

function toAscii(input: string): string {
  return normalizePunctuation(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfString(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function chunkLine(line: string, chunkSize: number): string[] {
  if (line.length === 0) {
    return [''];
  }

  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += chunkSize) {
    chunks.push(line.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeBodyLines(body: string): string[] {
  const lines = body.replace(/\r/g, '').split('\n');
  return lines.flatMap((line) => chunkLine(toAscii(line), MAX_CHARS_PER_LINE));
}

function buildPageStream(options: {
  title: string;
  subtitle: string;
  settings: string;
  pageIndex: number;
  pageCount: number;
  lines: string[];
}): string {
  const { title, subtitle, settings, pageIndex, pageCount, lines } = options;
  const stream: string[] = [
    'BT',
    '/F1 12 Tf',
    '36 806 Td',
    '13 TL',
    `(${escapePdfString(toAscii(title))}) Tj`,
    'T*',
    '/F1 9 Tf',
    `(${escapePdfString(toAscii(subtitle))}) Tj`,
    'T*',
    `(${escapePdfString(toAscii(settings))}) Tj`,
    'T*',
    `(${escapePdfString(`Page ${pageIndex + 1}/${pageCount}`)}) Tj`,
    'T*',
    'T*',
    '/F1 10 Tf',
    '11 TL'
  ];

  for (const line of lines) {
    const printable = line.length > 0 ? line : ' ';
    stream.push(`(${escapePdfString(printable)}) Tj`);
    stream.push('T*');
  }

  stream.push('ET');

  return stream.join('\n');
}

function buildPdfDocument(options: DownloadPdfOptions): Blob {
  const subtitle = `Artist: ${options.artist}`;
  const settings = `Transpose: ${options.semitones >= 0 ? '+' : ''}${options.semitones} | Simplify: ${
    options.simplify ? 'on' : 'off'
  } | Text size: ${options.fontSize}px`;

  const bodyLines = normalizeBodyLines(options.body);
  const pages: string[][] = [];
  for (let i = 0; i < bodyLines.length; i += MAX_LINES_PER_PAGE) {
    pages.push(bodyLines.slice(i, i + MAX_LINES_PER_PAGE));
  }

  if (pages.length === 0) {
    pages.push(['']);
  }

  const objects: string[] = [];

  const pushObject = (content: string): number => {
    objects.push(content);
    return objects.length;
  };

  const catalogObject = pushObject('');
  const pagesObject = pushObject('');
  const fontObject = pushObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const pageObjectNumbers: number[] = [];
  const contentObjectNumbers: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const stream = buildPageStream({
      title: options.title,
      subtitle,
      settings,
      pageIndex,
      pageCount: pages.length,
      lines: pages[pageIndex]
    });

    const streamLength = encoder.encode(stream).length;
    const contentObject = pushObject(
      `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`
    );
    const pageObject = pushObject('');

    contentObjectNumbers.push(contentObject);
    pageObjectNumbers.push(pageObject);
  }

  objects[catalogObject - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((num) => `${num} 0 R`)
    .join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  pageObjectNumbers.forEach((pageObjectNumber, idx) => {
    objects[pageObjectNumber - 1] =
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontObject} 0 R >> >> ` +
      `/Contents ${contentObjectNumbers[idx]} 0 R >>`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let index = 1; index <= objects.length; index += 1) {
    offsets[index] = encoder.encode(pdf).length;
    pdf += `${index} 0 obj\n${objects[index - 1]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index <= objects.length; index += 1) {
    const offset = String(offsets[index]).padStart(10, '0');
    pdf += `${offset} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function sanitizeFileName(input: string): string {
  return toAscii(input)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function downloadSongPdf(options: DownloadPdfOptions): void {
  const pdfBlob = buildPdfDocument(options);
  const fileNameBase = sanitizeFileName(`${options.title}-${options.artist}`) || 'chords4all-song';

  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${fileNameBase}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}

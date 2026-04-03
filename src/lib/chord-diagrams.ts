export type Fret = number | 'x';

export type ChordDiagram = {
  id: string;
  label: string;
  baseFret: number;
  frets: [Fret, Fret, Fret, Fret, Fret, Fret];
};

const PRIMARY_DIAGRAMS: Record<string, ChordDiagram> = {
  C: { id: 'C', label: 'C', baseFret: 1, frets: ['x', 3, 2, 0, 1, 0] },
  Cm: { id: 'Cm', label: 'Cm', baseFret: 3, frets: ['x', 3, 5, 5, 4, 3] },
  'C#': { id: 'C#', label: 'C#', baseFret: 4, frets: ['x', 4, 6, 6, 6, 4] },
  'C#m': { id: 'C#m', label: 'C#m', baseFret: 4, frets: ['x', 4, 6, 6, 5, 4] },
  D: { id: 'D', label: 'D', baseFret: 1, frets: ['x', 'x', 0, 2, 3, 2] },
  Dm: { id: 'Dm', label: 'Dm', baseFret: 1, frets: ['x', 'x', 0, 2, 3, 1] },
  'D#': { id: 'D#', label: 'D#', baseFret: 6, frets: ['x', 6, 8, 8, 8, 6] },
  'D#m': { id: 'D#m', label: 'D#m', baseFret: 6, frets: ['x', 6, 8, 8, 7, 6] },
  E: { id: 'E', label: 'E', baseFret: 1, frets: [0, 2, 2, 1, 0, 0] },
  Em: { id: 'Em', label: 'Em', baseFret: 1, frets: [0, 2, 2, 0, 0, 0] },
  F: { id: 'F', label: 'F', baseFret: 1, frets: [1, 3, 3, 2, 1, 1] },
  Fm: { id: 'Fm', label: 'Fm', baseFret: 1, frets: [1, 3, 3, 1, 1, 1] },
  'F#': { id: 'F#', label: 'F#', baseFret: 2, frets: [2, 4, 4, 3, 2, 2] },
  'F#m': { id: 'F#m', label: 'F#m', baseFret: 2, frets: [2, 4, 4, 2, 2, 2] },
  G: { id: 'G', label: 'G', baseFret: 1, frets: [3, 2, 0, 0, 0, 3] },
  Gm: { id: 'Gm', label: 'Gm', baseFret: 3, frets: [3, 5, 5, 3, 3, 3] },
  'G#': { id: 'G#', label: 'G#', baseFret: 4, frets: [4, 6, 6, 5, 4, 4] },
  'G#m': { id: 'G#m', label: 'G#m', baseFret: 4, frets: [4, 6, 6, 4, 4, 4] },
  A: { id: 'A', label: 'A', baseFret: 1, frets: ['x', 0, 2, 2, 2, 0] },
  Am: { id: 'Am', label: 'Am', baseFret: 1, frets: ['x', 0, 2, 2, 1, 0] },
  'A#': { id: 'A#', label: 'A#', baseFret: 1, frets: ['x', 1, 3, 3, 3, 1] },
  'A#m': { id: 'A#m', label: 'A#m', baseFret: 1, frets: ['x', 1, 3, 3, 2, 1] },
  B: { id: 'B', label: 'B', baseFret: 2, frets: ['x', 2, 4, 4, 4, 2] },
  Bm: { id: 'Bm', label: 'Bm', baseFret: 2, frets: ['x', 2, 4, 4, 3, 2] }
};

const ALTERNATIVE_DIAGRAMS: Record<string, ChordDiagram[]> = {
  C: [{ id: 'C-alt-1', label: 'C', baseFret: 8, frets: [8, 10, 10, 9, 8, 8] }],
  Cm: [{ id: 'Cm-alt-1', label: 'Cm', baseFret: 8, frets: [8, 10, 10, 8, 8, 8] }],
  D: [{ id: 'D-alt-1', label: 'D', baseFret: 5, frets: ['x', 5, 7, 7, 7, 5] }],
  Dm: [{ id: 'Dm-alt-1', label: 'Dm', baseFret: 5, frets: ['x', 5, 7, 7, 6, 5] }],
  E: [{ id: 'E-alt-1', label: 'E', baseFret: 7, frets: [0, 7, 9, 9, 9, 7] }],
  Em: [{ id: 'Em-alt-1', label: 'Em', baseFret: 7, frets: [0, 7, 9, 9, 8, 7] }],
  F: [{ id: 'F-alt-1', label: 'F', baseFret: 8, frets: ['x', 8, 10, 10, 10, 8] }],
  Fm: [{ id: 'Fm-alt-1', label: 'Fm', baseFret: 8, frets: ['x', 8, 10, 10, 9, 8] }],
  G: [{ id: 'G-alt-1', label: 'G', baseFret: 3, frets: [3, 5, 5, 4, 3, 3] }],
  Gm: [{ id: 'Gm-alt-1', label: 'Gm', baseFret: 10, frets: [10, 12, 12, 10, 10, 10] }],
  A: [{ id: 'A-alt-1', label: 'A', baseFret: 5, frets: [5, 7, 7, 6, 5, 5] }],
  Am: [{ id: 'Am-alt-1', label: 'Am', baseFret: 5, frets: [5, 7, 7, 5, 5, 5] }],
  B: [{ id: 'B-alt-1', label: 'B', baseFret: 7, frets: [7, 9, 9, 8, 7, 7] }],
  Bm: [{ id: 'Bm-alt-1', label: 'Bm', baseFret: 7, frets: [7, 9, 9, 7, 7, 7] }]
};

const IT_TO_EN: Record<string, string> = {
  DO: 'C',
  'DO#': 'C#',
  RE: 'D',
  'RE#': 'D#',
  MI: 'E',
  FA: 'F',
  'FA#': 'F#',
  SOL: 'G',
  'SOL#': 'G#',
  LA: 'A',
  'LA#': 'A#',
  SI: 'B'
};

const ROOT_RE = /^(DO#?|RE#?|MI|FA#?|SOL#?|LA#?|SI|[A-G](?:#|b)?)(.*)$/i;

function normalizeRoot(root: string): string {
  const upper = root.toUpperCase().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (IT_TO_EN[upper]) {
    return IT_TO_EN[upper];
  }

  if (upper.length === 2 && upper.endsWith('B')) {
    const flatMap: Record<string, string> = {
      DB: 'C#',
      EB: 'D#',
      GB: 'F#',
      AB: 'G#',
      BB: 'A#'
    };

    return flatMap[upper] ?? upper;
  }

  return upper;
}

export function toDiagramId(chord: string): string {
  const match = chord.trim().match(ROOT_RE);
  if (!match) {
    return chord;
  }

  const [, root, rest] = match;
  const normalizedRoot = normalizeRoot(root);
  const isMinor = /^m(?!aj)/i.test(rest) || /^min/i.test(rest);

  return `${normalizedRoot}${isMinor ? 'm' : ''}`;
}

export function getChordDiagram(chord: string): ChordDiagram | undefined {
  const id = toDiagramId(chord);
  const primary = PRIMARY_DIAGRAMS[id];
  if (primary) {
    return primary;
  }

  return ALTERNATIVE_DIAGRAMS[id]?.[0];
}

export function getChordDiagrams(chord: string): ChordDiagram[] {
  const id = toDiagramId(chord);
  const primary = PRIMARY_DIAGRAMS[id];
  const alternatives = ALTERNATIVE_DIAGRAMS[id] ?? [];

  if (primary) {
    return [primary, ...alternatives];
  }

  return [...alternatives];
}

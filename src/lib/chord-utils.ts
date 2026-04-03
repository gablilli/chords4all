const EN_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const IT_SCALE = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'] as const;

const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'B#': 0,
  DO: 0,
  'DO#': 1,
  DB: 1,
  REB: 1,
  'C#': 1,
  D: 2,
  RE: 2,
  'D#': 3,
  EB: 3,
  'RE#': 3,
  MIB: 3,
  E: 4,
  FB: 4,
  MI: 4,
  F: 5,
  'E#': 5,
  FA: 5,
  'F#': 6,
  GB: 6,
  'FA#': 6,
  SOLB: 6,
  G: 7,
  SOL: 7,
  'G#': 8,
  AB: 8,
  'SOL#': 8,
  LAB: 8,
  A: 9,
  LA: 9,
  'A#': 10,
  BB: 10,
  'LA#': 10,
  SIB: 10,
  B: 11,
  CB: 11,
  SI: 11
};

const ROOT_RE = /^(DO#?|RE#?|MI|FA#?|SOL#?|LA#?|SI|[A-G](?:#|b)?)(.*)$/i;
const ROOT_PATTERN = '(?:DO|RE|MI|FA|SOL|LA|SI|[A-G])(?:#|B)?';
const SUFFIX_PATTERN =
  '(?:M(?!AJ)|MIN|MAJ|DIM|AUG|SUS(?:2|4)?|ADD\\d+|[0-9]+|[#B][0-9]+|\\+|-)';
const CHORD_STRICT_RE = new RegExp(
  `^${ROOT_PATTERN}(?:${SUFFIX_PATTERN})*(?:\/${ROOT_PATTERN})?$`,
  'i'
);
const LEADING_AFFIX_RE = /^([([{'"`«“‘]*)(.*)$/;
const TRAILING_AFFIX_RE = /^(.*?)([)\]}'"`»”’.,;:!?]*)$/;

type TokenParts = {
  leading: string;
  core: string;
  trailing: string;
};

function normalizeRoot(root: string): string {
  return root
    .toUpperCase()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'B');
}

function normalizeToken(token: string): string {
  return token.trim().toUpperCase().replace(/♯/g, '#').replace(/♭/g, 'B');
}

function splitAffixes(token: string): TokenParts {
  const leadMatch = token.match(LEADING_AFFIX_RE);
  const leading = leadMatch?.[1] ?? '';
  const rest = leadMatch?.[2] ?? token;

  const trailMatch = rest.match(TRAILING_AFFIX_RE);
  const core = trailMatch?.[1] ?? rest;
  const trailing = trailMatch?.[2] ?? '';

  return { leading, core, trailing };
}

function isLikelyChordToken(token: string): boolean {
  if (!token) {
    return false;
  }

  return CHORD_STRICT_RE.test(normalizeToken(token));
}

function toSharpName(index: number, notation: 'en' | 'it'): string {
  const wrapped = ((index % 12) + 12) % 12;
  return notation === 'it' ? IT_SCALE[wrapped] : EN_SCALE[wrapped];
}

function detectNotationFromRoot(root: string): 'en' | 'it' {
  const upper = root.toUpperCase();
  if (['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'].some((token) => upper.startsWith(token))) {
    return 'it';
  }

  return 'en';
}

export function transposeChordToken(token: string, semitones: number): string {
  if (!semitones) {
    return token;
  }

  const match = token.match(ROOT_RE);
  if (!match) {
    return token;
  }

  const [, rawRoot, suffix] = match;
  const normalizedRoot = normalizeRoot(rawRoot);
  const rootIndex = NOTE_INDEX[normalizedRoot];

  if (rootIndex === undefined) {
    return token;
  }

  const notation = detectNotationFromRoot(rawRoot);
  const transposedRoot = toSharpName(rootIndex + semitones, notation);

  const slashMatch = suffix.match(/\/(DO#?|RE#?|MI|FA#?|SOL#?|LA#?|SI|[A-G](?:#|b)?)/i);
  if (!slashMatch) {
    return `${transposedRoot}${suffix}`;
  }

  const bassRaw = slashMatch[1];
  const bassIndex = NOTE_INDEX[normalizeRoot(bassRaw)];
  if (bassIndex === undefined) {
    return `${transposedRoot}${suffix}`;
  }

  const transposedBass = toSharpName(bassIndex + semitones, notation);
  const updatedSuffix = suffix.replace(slashMatch[1], transposedBass);

  return `${transposedRoot}${updatedSuffix}`;
}

export function simplifyChordToken(token: string): string {
  if (!isLikelyChordToken(token)) {
    return token;
  }

  const match = token.match(ROOT_RE);
  if (!match) {
    return token;
  }

  const [, root, suffix] = match;
  const slashPart = suffix.includes('/') ? suffix.slice(suffix.indexOf('/')) : '';
  const qualityPart = suffix.replace(slashPart, '');
  const minor = /^m(?!aj)/i.test(qualityPart) || /^min/i.test(qualityPart);

  return `${root}${minor ? 'm' : ''}${slashPart}`;
}

function transformToken(
  token: string,
  options: {
    semitones: number;
    simplify: boolean;
  }
): string {
  const { leading, core, trailing } = splitAffixes(token);
  if (!isLikelyChordToken(core)) {
    return token;
  }

  let output = core;
  if (options.simplify) {
    output = simplifyChordToken(output);
  }

  if (options.semitones) {
    output = transposeChordToken(output, options.semitones);
  }

  return `${leading}${output}${trailing}`;
}

export function isChordLine(line: string): boolean {
  const clean = line.trim();
  if (!clean) {
    return false;
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 24) {
    return false;
  }

  const chordCount = tokens.filter((token) => isLikelyChordToken(splitAffixes(token).core)).length;
  if (chordCount === 0) {
    return false;
  }

  const ratio = chordCount / tokens.length;
  return ratio >= 0.5;
}

export function transformChordBlock(
  source: string,
  options: {
    semitones: number;
    simplify: boolean;
  }
): string {
  const { semitones, simplify } = options;

  return source
    .split('\n')
    .map((line) => {
      return line
        .split(/(\s+)/)
        .map((token) => {
          if (!token || /^\s+$/.test(token)) {
            return token;
          }

          return transformToken(token, { semitones, simplify });
        })
        .join('');
    })
    .join('\n');
}

export function extractUniqueChords(source: string): string[] {
  const seen = new Set<string>();

  for (const line of source.split('\n')) {
    for (const token of line.split(/\s+/).filter(Boolean)) {
      const core = splitAffixes(token).core;
      if (!isLikelyChordToken(core)) {
        continue;
      }

      const chord = simplifyChordToken(core.trim());
      if (chord) {
        seen.add(chord);
      }
    }
  }

  return [...seen];
}

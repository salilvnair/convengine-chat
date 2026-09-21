/**
 * Audit Explorer colour palettes.
 *
 * Kept as data, not CSS attribute blocks, so a consumer can pass their own
 * palette object — or override single keys of a preset — and so the presets
 * can be listed in a UI. Every key maps to one --ce-ax-* CSS variable.
 *
 *   aurora  (default)  violet into pink on plum ink
 *   lagoon             teal into sky on deep sea green
 *   ember              orange into rose on roasted brown
 *   indigo             the chat widget's own indigo/slate, for a matched pair
 */
export const AUDIT_EXPLORER_PALETTES = {
  aurora: {
    light: {
      ground: '#f6f4fb', surface: '#ffffff', surface2: '#f1edf9',
      ink: '#1c1630', ink2: '#463d5c', muted: '#6e6485',
      line: '#e7e1f1', line2: '#d6cde6',
      accent: '#7c3aed', accent2: '#db2777', accentInk: '#6d28d9',
      codeBg: '#f8f5fd', string: '#0f766e', number: '#b45309',
      ok: '#16a34a', warn: '#b45309', err: '#dc2626', llm: '#d97706',
    },
    dark: {
      ground: '#0e0b15', surface: '#15111e', surface2: '#1c1727',
      ink: '#efeaf7', ink2: '#cdc4dd', muted: '#9d93b3',
      line: '#272036', line2: '#372e49',
      accent: '#a78bfa', accent2: '#f472b6', accentInk: '#c4b5fd',
      codeBg: '#110d19', string: '#5eead4', number: '#fbbf24',
      ok: '#4ade80', warn: '#fbbf24', err: '#f87171', llm: '#fbbf24',
    },
  },
  lagoon: {
    light: {
      ground: '#f2f8f8', surface: '#ffffff', surface2: '#eaf4f4',
      ink: '#0f2326', ink2: '#36525a', muted: '#5b7780',
      line: '#dbe9ea', line2: '#c5dadd',
      accent: '#0d9488', accent2: '#0284c7', accentInk: '#0f766e',
      codeBg: '#f1f8f8', string: '#7c3aed', number: '#b45309',
      ok: '#16a34a', warn: '#b45309', err: '#dc2626', llm: '#d97706',
    },
    dark: {
      ground: '#081113', surface: '#0d191c', surface2: '#122226',
      ink: '#e3f1f1', ink2: '#b9d3d5', muted: '#85a3a8',
      line: '#1b2e32', line2: '#274247',
      accent: '#2dd4bf', accent2: '#38bdf8', accentInk: '#5eead4',
      codeBg: '#0a1517', string: '#c4b5fd', number: '#fbbf24',
      ok: '#4ade80', warn: '#fbbf24', err: '#f87171', llm: '#fbbf24',
    },
  },
  ember: {
    light: {
      ground: '#faf7f2', surface: '#ffffff', surface2: '#f5efe6',
      ink: '#2a1d12', ink2: '#5a4533', muted: '#806a57',
      line: '#ece2d4', line2: '#dfd0bb',
      accent: '#ea580c', accent2: '#e11d48', accentInk: '#c2410c',
      codeBg: '#fbf8f3', string: '#0f766e', number: '#7c3aed',
      ok: '#16a34a', warn: '#b45309', err: '#dc2626', llm: '#ca8a04',
    },
    dark: {
      ground: '#120d09', surface: '#1a130e', surface2: '#231a13',
      ink: '#f4ece3', ink2: '#d8c8b6', muted: '#a8927c',
      line: '#2e231a', line2: '#3f3124',
      accent: '#fb923c', accent2: '#fb7185', accentInk: '#fdba74',
      codeBg: '#150f0b', string: '#5eead4', number: '#c4b5fd',
      ok: '#4ade80', warn: '#fbbf24', err: '#f87171', llm: '#facc15',
    },
  },
  indigo: {
    light: {
      ground: '#f6f7fb', surface: '#ffffff', surface2: '#f1f3f8',
      ink: '#1e293b', ink2: '#475569', muted: '#64748b',
      line: '#e3e6ee', line2: '#d3d8e3',
      accent: '#6366f1', accent2: '#8b5cf6', accentInk: '#4f46e5',
      codeBg: '#f4f5fa', string: '#0f766e', number: '#b45309',
      ok: '#16a34a', warn: '#b45309', err: '#dc2626', llm: '#d97706',
    },
    dark: {
      ground: '#15161b', surface: '#1c1d24', surface2: '#23252e',
      ink: '#e6e8ef', ink2: '#c3c8d4', muted: '#939aab',
      line: '#2b2e38', line2: '#3a3e4b',
      accent: '#818cf8', accent2: '#c084fc', accentInk: '#a5b4fc',
      codeBg: '#17181e', string: '#5eead4', number: '#fbbf24',
      ok: '#4ade80', warn: '#fbbf24', err: '#f87171', llm: '#fbbf24',
    },
  },
};

/** Palette key → CSS variable. */
export const PALETTE_VARS = {
  ground:    '--ce-ax-ground',
  surface:   '--ce-ax-surface',
  surface2:  '--ce-ax-surface-2',
  ink:       '--ce-ax-ink',
  ink2:      '--ce-ax-ink-2',
  muted:     '--ce-ax-muted',
  line:      '--ce-ax-line',
  line2:     '--ce-ax-line-2',
  accent:    '--ce-ax-accent',
  accent2:   '--ce-ax-accent-2',
  accentInk: '--ce-ax-accent-ink',
  codeBg:    '--ce-ax-code-bg',
  string:    '--ce-ax-string',
  number:    '--ce-ax-number',
  ok:        '--ce-ax-ok',
  warn:      '--ce-ax-warn',
  err:       '--ce-ax-err',
  llm:       '--ce-ax-llm',
};

/** config shorthand → palette key, mirroring ConvEngineChat's colour config. */
export const COLOR_SHORTHANDS = {
  accentColor:        'accent',
  accentColor2:       'accent2',
  groundColor:        'ground',
  surfaceColor:       'surface',
  surfaceAltColor:    'surface2',
  textColor:          'ink',
  secondaryTextColor: 'ink2',
  mutedTextColor:     'muted',
  borderColor:        'line',
  borderStrongColor:  'line2',
  codeBgColor:        'codeBg',
  okColor:            'ok',
  warnColor:          'warn',
  errorColor:         'err',
  llmColor:           'llm',
};

/**
 * Resolves the palette for one scheme.
 *
 * @param {string|{light?:object,dark?:object}} palette  a preset name, or a
 *        partial palette whose keys merge over `base` (default aurora)
 * @param {boolean} dark
 * @param {string} [base]  preset to merge a custom palette over
 */
export function resolvePalette(palette, dark, base = 'aurora') {
  const scheme = dark ? 'dark' : 'light';
  if (typeof palette === 'string') {
    return AUDIT_EXPLORER_PALETTES[palette]?.[scheme] ?? AUDIT_EXPLORER_PALETTES.aurora[scheme];
  }
  const from = AUDIT_EXPLORER_PALETTES[base]?.[scheme] ?? AUDIT_EXPLORER_PALETTES.aurora[scheme];
  return { ...from, ...(palette?.[scheme] ?? {}) };
}

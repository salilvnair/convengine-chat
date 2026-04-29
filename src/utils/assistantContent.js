/* ── Markdown table helpers ───────────────────────────────────────────────── */

function isMarkdownTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/* ── Public helpers ───────────────────────────────────────────────────────── */

const KNOWN_ACRONYMS = new Map([
  ['id', 'ID'],
  ['ui', 'UI'],
  ['api', 'API'],
  ['sql', 'SQL'],
  ['url', 'URL'],
  ['aso', 'ASO'],
]);

/**
 * Converts a raw markdown column header like `user_id` → `User ID`.
 */
export function prettifyHeader(header) {
  const raw = String(header ?? '').trim();
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((token) => {
      const lower = token.toLowerCase();
      return KNOWN_ACRONYMS.get(lower) ?? (lower.charAt(0).toUpperCase() + lower.slice(1));
    })
    .join(' ');
}

/**
 * Parses an assistant response string into an array of segments.
 * Each segment is either `{ type: 'text', text: string }` or
 * `{ type: 'table', headers: string[], rows: string[][] }`.
 */
export function parseAssistantSegments(text) {
  const source = typeof text === 'string' ? text : String(text ?? '');
  const lines = source.split(/\r?\n/);
  const segments = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';

    if (!line.includes('|') || !isMarkdownTableSeparator(next)) {
      // Accumulate non-table lines
      const start = i;
      i += 1;
      while (i < lines.length) {
        const maybeSep = i + 1 < lines.length ? lines[i + 1] : '';
        if (lines[i].includes('|') && isMarkdownTableSeparator(maybeSep)) break;
        i += 1;
      }
      const block = lines.slice(start, i).join('\n').trim();
      if (block) segments.push({ type: 'text', text: block });
      continue;
    }

    // Table found — parse header + rows
    const headers = splitMarkdownRow(line);
    const rows = [];
    i += 2; // skip header + separator
    while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
      rows.push(splitMarkdownRow(lines[i]));
      i += 1;
    }
    segments.push({ type: 'table', headers, rows });
    // Skip blank lines after table
    while (i < lines.length && !lines[i].trim()) i += 1;
  }

  return segments.length ? segments : [{ type: 'text', text: source }];
}

/**
 * Returns true if the text contains at least one markdown table block.
 */
export function containsMarkdownTable(text) {
  return parseAssistantSegments(text).some((s) => s.type === 'table');
}

/**
 * Coloured JSON for the audit views, as HTML that is safe to inject: the text is escaped first, then
 * keys, strings, numbers, booleans and null are wrapped in spans. Escaped newlines inside strings
 * ("\n" in a prompt) become real line breaks, so long prompts read as text instead of one long line.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A JSON value or a string holding JSON, pretty-printed; null when it is not JSON. */
export function toPrettyJson(value) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    try { return JSON.stringify(value, null, 2); } catch { return null; }
  }
  const t = value.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return null;
  try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return null; }
}

// one JSON token at a time: "string" (then : for a key) | number | true/false/null | punctuation
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false)\b|\b(null)\b|([{}[\],])/g;

/** Pretty JSON text -> highlighted HTML. */
export function jsonToHtml(prettyText) {
  let out = '';
  let last = 0;
  prettyText.replace(TOKEN, (m, str, colon, num, bool, nul, punct, offset) => {
    out += esc(prettyText.slice(last, offset));
    last = offset + m.length;
    if (str) {
      // inside a string: \n -> a real line break, \t -> spaces, \" -> "
      const body = esc(str).replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\&quot;/g, '&quot;');
      out += colon
        ? `<span class="ce-json-key">${body}</span><span class="ce-json-punct">${esc(colon)}</span>`
        : `<span class="ce-json-str">${body}</span>`;
    } else if (num) out += `<span class="ce-json-num">${num}</span>`;
    else if (bool) out += `<span class="ce-json-bool">${bool}</span>`;
    else if (nul) out += `<span class="ce-json-null">null</span>`;
    else out += `<span class="ce-json-punct">${esc(punct)}</span>`;
    return m;
  });
  return out + esc(prettyText.slice(last));
}

// inside a line of prose: "quoted" | ${placeholder} | `code` | CAPS words | schema.table names
const INLINE = /(&quot;[^\n]*?&quot;|“[^”\n]*”)|(\$\{[^}\n]+\})|(`[^`\n]+`)|(\b[A-Z][A-Z0-9_]{2,}\b)|(\b[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?\b)/g;

function inlineHtml(escaped) {
  return escaped.replace(INLINE, (m, q, ph, code, caps, ident) => {
    if (q) return `<span class="ce-txt-quote">${m}</span>`;
    if (ph) return `<span class="ce-txt-ph">${m}</span>`;
    if (code) return `<span class="ce-txt-code">${m}</span>`;
    if (caps) return `<span class="ce-txt-caps">${m}</span>`;
    if (ident) return `<span class="ce-txt-ident">${m}</span>`;
    return m;
  });
}

/**
 * Prose (a prompt, a reply) -> coloured HTML: numbered rules and bullets, "Heading:" lines,
 * quoted text, ${placeholders}, `code`, CAPS keywords (NEVER, ALWAYS, SELECT…) and schema.table names.
 */
export function textToHtml(text) {
  return String(text ?? '').split('\n').map((line) => {
    const e = esc(line);
    // "Rules:" / "── CATEGORIES ──" / "Schema/table correctness (PostgreSQL):" on a line of its own
    if (/^\s*[^\s].{0,80}:\s*$/.test(line) && !/^\s*[-*•\d]/.test(line)) return `<span class="ce-txt-head">${e}</span>`;
    if (/^\s*[─━=]{2,}.*[─━=]{2,}\s*$/.test(line)) return `<span class="ce-txt-head">${e}</span>`;
    const num = /^(\s*)(\d+[.)])(\s.*)?$/.exec(e);
    if (num) return `${num[1]}<span class="ce-txt-num">${num[2]}</span>${inlineHtml(num[3] ?? '')}`;
    const bullet = /^(\s*)([-*•])(\s.*)$/.exec(e);
    if (bullet) return `${bullet[1]}<span class="ce-txt-bullet">${bullet[2]}</span>${inlineHtml(bullet[3])}`;
    return inlineHtml(e);
  }).join('\n');
}

/** HTML for any value: coloured JSON when it is JSON, coloured prose otherwise. */
export function valueToHtml(value) {
  const pretty = toPrettyJson(value);
  if (pretty != null) return jsonToHtml(pretty);
  return textToHtml(typeof value === 'string' ? value : String(value ?? ''));
}

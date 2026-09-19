import { useEffect, useMemo, useState } from 'react';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';
import { stageMeta } from './AuditStages.js';

/* ── Rendering strategy ──────────────────────────────────────────────────────
 * The engine writes 100+ distinct stages, each with its own payload shape, and
 * the list grows. Hand-writing a card per stage does not scale and leaves every
 * new stage rendering as a raw JSON dump — which is what this panel used to do
 * for everything except three LLM stages the engine does not even emit.
 *
 * So cards are built from the payload's SHAPE instead of its stage:
 *   - short scalars       → a labelled chip (intent, state, confidence, …)
 *   - the headline field  → the card's prose line (question / answer / error)
 *   - long text & objects → a collapsed disclosure, opened on demand
 * Nothing is dropped: `{ }` on any card swaps in the raw payload.
 *
 * The result is that a stage nobody has seen before still reads as a card, and
 * the stages people read constantly (USER_INPUT, ASSISTANT_OUTPUT) read well.
 */

function parsePayload(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    // A payload can legitimately be a bare string or number.
    return (parsed && typeof parsed === 'object') ? parsed : { _text: String(parsed) };
  } catch {
    return { _text: String(raw) };
  }
}

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/* The field that becomes the card's prose line, in priority order. The engine
   is not consistent about this (text / userText / question / output / answer),
   and being generous here is what keeps the common cards readable. */
const HEADLINE_KEYS = ['text', 'question', 'userText', 'answer', 'output', 'final_answer', 'message'];
const ERROR_KEYS    = ['error', 'errorMessage', 'exception', 'errorCode'];

/* Keys pulled to the front of the chip row — the engine's own vocabulary for
   "what did this step decide". Everything else keeps payload order. */
const LEAD_KEYS = [
  'intent', 'state', 'resolvedIntent', 'previousIntent', 'source',
  'dialogueAct', 'policyDecision', 'result', 'confidence',
  'ruleId', 'action', 'tool_code', 'outputFormat', 'responseType', 'totalMs',
];

/* Longer than this and a value gets its own disclosure instead of a chip. */
const CHIP_MAX_LEN = 48;

/* A headline is prose. Past this length, or when the "prose" is really an
   encoded payload (ASSISTANT_OUTPUT carries a JSON string when outputFormat is
   JSON), it belongs in a disclosure — a 2,000-character blob of escaped JSON
   set as a paragraph is exactly what made this panel unreadable. */
const HEADLINE_MAX_LEN = 260;

function looksEncoded(text) {
  const t = text.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function isScalar(v) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

/** Splits a payload into { headline, error, chips, blocks } for rendering. */
function planCard(data) {
  const entries = Object.entries(data ?? {});

  let headline = null;
  let headlineKey = null;
  for (const key of HEADLINE_KEYS) {
    const v = data?.[key];
    if (typeof v === 'string' && v.trim()) { headline = v; headlineKey = key; break; }
  }

  let error = null;
  for (const key of ERROR_KEYS) {
    const v = data?.[key];
    if (typeof v === 'string' && v.trim()) { error = v; break; }
  }

  const chips  = [];
  const blocks = [];

  // Demote a headline that is too long, or that is an encoded payload rather
  // than a sentence, into a disclosure instead of a paragraph.
  if (headline && (headline.length > HEADLINE_MAX_LEN || looksEncoded(headline))) {
    const pretty = looksEncoded(headline)
      ? (() => { try { return prettyJson(JSON.parse(headline)); } catch { return headline; } })()
      : headline;
    blocks.push({ key: headlineKey, text: pretty });
    headline = null;
  }

  for (const [key, value] of entries) {
    if (key === headlineKey || key === '_text') continue;
    // Drop empties rather than printing a wall of nulls — `{ }` still has them.
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (!isScalar(value) && !Array.isArray(value) && Object.keys(value).length === 0) continue;

    if (isScalar(value)) {
      const text = String(value);
      if (text.length <= CHIP_MAX_LEN) chips.push({ key, value: text, raw: value });
      else blocks.push({ key, text });
    }
    else {
      blocks.push({ key, text: prettyJson(value) });
    }
  }

  // Lead keys first, in the order listed; the rest keep payload order.
  chips.sort((a, b) => {
    const ia = LEAD_KEYS.indexOf(a.key);
    const ib = LEAD_KEYS.indexOf(b.key);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  if (!headline && typeof data?._text === 'string') headline = data._text;

  return { headline, error, chips, blocks };
}

/* ── Small building blocks ───────────────────────────────────────────────── */

function StageDot({ color }) {
  return <span className="ce-audit-dot" style={{ background: color }} aria-hidden />;
}

/** A labelled key/value chip. Booleans get a tone so true/false reads at a glance. */
function Chip({ label, value, raw }) {
  const tone = typeof raw === 'boolean' ? (raw ? 'is-true' : 'is-false') : '';
  return (
    <span className={`ce-audit-chip ${tone}`}>
      <span className="ce-audit-chip-key">{label}</span>
      <span className="ce-audit-chip-val">{value}</span>
    </span>
  );
}

/** A long value (prompt, context, SQL, tool rows) shown collapsed. */
function Collapsible({ label, text, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { ChevronDownIcon } = useIcons();
  const value = typeof text === 'string' ? text : prettyJson(text);
  if (!value || !value.trim()) return null;
  return (
    <div className={`ce-audit-collapsible ${open ? 'is-open' : ''}`}>
      <button type="button" className="ce-audit-collapsible-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronDownIcon className={`ce-audit-chevron ${open ? 'ce-audit-chevron--open' : ''}`} />
        <span className="ce-audit-field-label">{label}</span>
        <span className="ce-audit-collapsible-len">{value.length.toLocaleString()} chars</span>
      </button>
      {open && <pre className="ce-audit-pre">{value}</pre>}
    </div>
  );
}

/* ── Single audit entry ───────────────────────────────────────────────────── */

function AuditEntry({ entry, index, showConversation = false, onOpenConversation }) {
  const [showRaw, setShowRaw] = useState(false);
  const stage = entry.stage ?? 'UNKNOWN';
  const meta  = stageMeta(stage);
  const data  = useMemo(
    () => parsePayload(entry.payloadJson ?? entry.payload_json ?? entry.payload) ?? {},
    [entry],
  );
  const plan  = useMemo(() => planCard(data), [data]);

  const isUser = meta.base === 'USER_INPUT';
  const empty  = !plan.headline && !plan.error && !plan.chips.length && !plan.blocks.length;

  return (
    <div className={`ce-audit-card ${meta.isError ? 'is-error' : ''}`} style={{ borderLeftColor: meta.color }}>
      <div className="ce-audit-card-head">
        <StageDot color={meta.color} />
        <span className="ce-audit-card-title">{meta.label}</span>
        {meta.sub && <span className="ce-audit-substage" title={stage}>{meta.sub}</span>}
        <span className="ce-audit-head-spacer" />
        <button
          type="button"
          className={`ce-audit-raw-toggle ${showRaw ? 'is-active' : ''}`}
          title={showRaw ? 'Hide raw payload' : `Show raw payload — ${stage}`}
          onClick={() => setShowRaw((v) => !v)}
        >
          {'{ }'}
        </button>
        <span className="ce-audit-step-no">{index + 1}</span>
      </div>

      {showConversation && entry.conversationId && (
        <button
          type="button"
          className="ce-audit-card-origin"
          title={`Open the full trail for ${entry.conversationId}`}
          onClick={() => onOpenConversation?.(entry.conversationId)}
        >
          from {entry.conversationId} →
        </button>
      )}

      <div className="ce-audit-card-body">
        {showRaw ? (
          <>
            <span className="ce-audit-raw-stage">{stage}</span>
            <pre className="ce-audit-pre ce-audit-pre--raw">{prettyJson(data)}</pre>
          </>
        ) : (
          <>
            {plan.error && <p className="ce-audit-answer ce-audit-error-text">{plan.error}</p>}
            {plan.headline && (
              <p className={isUser ? 'ce-audit-question' : 'ce-audit-answer'}>{plan.headline}</p>
            )}
            {plan.chips.length > 0 && (
              <div className="ce-audit-tagrow">
                {plan.chips.map((c) => <Chip key={c.key} label={c.key} value={c.value} raw={c.raw} />)}
              </div>
            )}
            {plan.blocks.map((b) => <Collapsible key={b.key} label={b.key} text={b.text} />)}
            {empty && <p className="ce-audit-muted">No payload.</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Audit panel ──────────────────────────────────────────────────────────── */

/**
 * Fetches and displays the ConvEngine audit trail for the current conversation.
 * Refreshes automatically whenever `auditRevision` increments (new response).
 */
export function AuditPanel({ auditRevision, onClose }) {
  const { conversationId, apiClient, config } = useConvEngineChatContext();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // ── Search ───────────────────────────────────────────────────────────────
  // Two different questions get asked of an audit trail, so the box answers
  // both: typing narrows the trail already on screen (instant, no request),
  // and Enter searches every conversation the backend has kept — which is the
  // only way to reach a trail from an hour ago whose id nobody wrote down.
  const showSearch = config?.showAuditSearch !== false;
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState(null); // { rows, total, query } | null
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  // A search hit can be from another conversation; opening one pins the panel
  // to that trail until you go back to the live one.
  const [pinned, setPinned] = useState(null); // { id, rows } | null
  const viewingId = pinned?.id ?? conversationId;

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .fetchAudit(conversationId)
      .then((data) => {
        if (cancelled) return;
        setEntries(Array.isArray(data) ? data : (data?.entries ?? []));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  // Re-fetch whenever a new assistant response arrives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditRevision, conversationId]);

  const handleCopy = () => {
    if (!conversationId) return;
    navigator.clipboard?.writeText(conversationId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  /** Rows shown: a pinned trail, else remote hits, else the live trail. */
  const source = pinned ? pinned.rows : (remote ? remote.rows : entries);

  /** Loads another conversation's full trail from a search hit. */
  const openConversation = async (id) => {
    if (!id) return;
    setSearching(true);
    setSearchError(null);
    try {
      const data = await apiClient.fetchAudit(id);
      setPinned({ id, rows: Array.isArray(data) ? data : (data?.entries ?? []) });
      setRemote(null);
      // Opening a hit means "show me that whole conversation", so the query
      // that found it must not then filter it back down to the matching rows.
      setQuery('');
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const backToLive = () => {
    setPinned(null);
    setRemote(null);
    setQuery('');
    setSearchError(null);
  };

  /**
   * Local narrowing — matches the stage name and the payload BODY.
   *
   * Deliberately excludes `_meta`: it carries a session snapshot whose
   * stepInfos name every step run so far, so once GuardrailStep has executed,
   * every later row contains the word "guardrail". Matching the envelope
   * returned 56 of 82 rows for that query — technically correct, useless in
   * practice. The body is what someone is actually looking for.
   */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || remote) return source;
    return source.filter((e) => {
      if (String(e.stage ?? '').toLowerCase().includes(q)) return true;
      const parsed = parsePayload(e.payloadJson ?? e.payload_json ?? e.payload);
      if (!parsed) return false;
      const { _meta, ...body } = parsed;
      return JSON.stringify(body).toLowerCase().includes(q);
    });
  }, [source, query, remote]);

  const runRemoteSearch = async () => {
    const q = query.trim();
    if (!q) return;
    if (typeof apiClient.searchAudit !== 'function') {
      setSearchError('This backend build has no audit search endpoint.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const { results, total } = await apiClient.searchAudit(q);
      setRemote({ rows: results, total, query: q });
    } catch (err) {
      setSearchError(err.message);
      setRemote(null);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setRemote(null);
    setSearchError(null);
    setPinned(null);
  };

  /** Conversations represented in a remote result, for the summary line. */
  const remoteConversations = useMemo(() => {
    if (!remote) return 0;
    return new Set(remote.rows.map((r) => r.conversationId).filter(Boolean)).size;
  }, [remote]);

  return (
    <aside className="ce-audit-panel" aria-label="Audit trail">
      <div className="ce-audit-panel-header">
        <span className="ce-audit-panel-title">Audit Timeline</span>
        {conversationId && (
          <span className="ce-audit-id-pill" title={conversationId}>{conversationId}</span>
        )}
        {loading && <span className="ce-audit-loading">…</span>}
        <div className="ce-audit-header-actions">
          {conversationId && (
            <button
              type="button"
              className="ce-audit-copy-btn"
              title={copied ? 'Copied!' : 'Copy conversation ID'}
              aria-label="Copy conversation ID"
              onClick={handleCopy}
            >
              {copied ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="ce-audit-close-btn"
              title="Close audit panel"
              aria-label="Close audit panel"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showSearch && (
        <div className="ce-audit-searchbar">
          <input
            type="search"
            className="ce-audit-search-input"
            placeholder="Filter this trail — Enter to search all conversations"
            value={query}
            aria-label="Search audit trail"
            onChange={(e) => { setQuery(e.target.value); if (remote) setRemote(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); runRemoteSearch(); }
              if (e.key === 'Escape') clearSearch();
            }}
          />
          {(query || remote) && (
            <button
              type="button"
              className="ce-audit-search-clear"
              title="Clear search"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              ×
            </button>
          )}
        </div>
      )}

      {showSearch && (query || remote || searching || searchError) && (
        <div className="ce-audit-searchnote">
          {searching && <span>Searching all conversations…</span>}
          {!searching && searchError && <span className="ce-audit-error-text">{searchError}</span>}
          {!searching && !searchError && remote && (
            <span>
              {remote.total} match{remote.total === 1 ? '' : 'es'} for “{remote.query}”
              {remoteConversations > 0 && ` across ${remoteConversations} conversation${remoteConversations === 1 ? '' : 's'}`}
            </span>
          )}
          {!searching && !searchError && !remote && !pinned && query && (
            <span>
              {visible.length} of {entries.length} in this trail · press Enter to search older conversations
            </span>
          )}
        </div>
      )}

      {pinned && (
        <div className="ce-audit-searchnote">
          <button type="button" className="ce-audit-back" onClick={backToLive}>
            ← back to the live trail
          </button>
          <span className="ce-audit-pinned-id" title={pinned.id}> · viewing {pinned.id}</span>
        </div>
      )}

      <div className="ce-audit-scroll">
        {error && <p className="ce-audit-error">{error}</p>}
        {!loading && !error && entries.length === 0 && !remote && (
          <p className="ce-audit-empty">No audit entries yet — ask a question to see how the answer was built.</p>
        )}
        {!loading && !error && visible.length === 0 && (entries.length > 0 || remote) && (
          <p className="ce-audit-empty">
            {remote ? `Nothing matched “${remote.query}”.` : 'Nothing in this trail matches that.'}
          </p>
        )}
        {visible.map((entry, i) => (
          <AuditEntry
            key={entry.auditId ?? entry.id ?? i}
            entry={entry}
            index={i}
            // A hit from another conversation is only readable if it says which
            // one it came from.
            showConversation={Boolean(remote) && entry.conversationId !== viewingId}
            onOpenConversation={openConversation}
          />
        ))}
      </div>
    </aside>
  );
}

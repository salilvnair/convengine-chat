import { useEffect, useState } from 'react';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';

/* ── Stage meta ───────────────────────────────────────────────────────────────
 * The host app decides which stages to write; this panel gives the ones it
 * knows a human label, an accent colour, and a purpose-built card body. An
 * LLM-baked chat only really cares about three: what the user asked, what we
 * sent the model, and what the model answered. Anything else falls back to a
 * generic JSON card so nothing is ever silently dropped.
 */
const STAGE_META = {
  USER_INPUT: { label: 'You asked', color: '#0ea5e9', kind: 'user' },
  LLM_INPUT: { label: 'Sent to the model', color: '#f59e0b', kind: 'input' },
  LLM_OUTPUT: { label: 'Model answer', color: '#22c55e', kind: 'output' },
  LLM_ERROR: { label: 'Error', color: '#ef4444', kind: 'error' },
  // Legacy / framework stages still render (generic card) if a host emits them.
  MCP_TOOL_RESULT: { label: 'Tool result', color: '#14b8a6', kind: 'generic' },
  MCP_FINAL_ANSWER: { label: 'Final answer', color: '#22c55e', kind: 'generic' },
  MCP_TOOL_ERROR: { label: 'Error', color: '#ef4444', kind: 'error' },
};

function stageMeta(stage) {
  return STAGE_META[stage] ?? { label: stage || 'Step', color: '#94a3b8', kind: 'generic' };
}

function parsePayload(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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

/* ── Small building blocks ───────────────────────────────────────────────── */

function StageDot({ color }) {
  return <span className="ce-audit-dot" style={{ background: color }} aria-hidden />;
}

function Pill({ children, color }) {
  return (
    <span
      className="ce-audit-pill"
      style={color ? { color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: `color-mix(in srgb, ${color} 30%, transparent)` } : undefined}
    >
      {children}
    </span>
  );
}

/** A long value (a prompt, the assembled context) shown collapsed with a
 *  one-click expand — so LLM_INPUT never dumps thousands of characters inline. */
function Collapsible({ label, text }) {
  const [open, setOpen] = useState(false);
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

function Field({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="ce-audit-field">
      <span className="ce-audit-field-label">{label}</span>
      <div className="ce-audit-field-value">{children}</div>
    </div>
  );
}

/* ── Per-stage card bodies ───────────────────────────────────────────────── */

function UserBody({ data }) {
  return (
    <>
      <p className="ce-audit-question">{data.question || data._text || '—'}</p>
      {data.project && data.project !== '(all)' && <Pill>project: {data.project}</Pill>}
    </>
  );
}

function InputBody({ data }) {
  return (
    <>
      <div className="ce-audit-tagrow">
        {data.model && <Pill color="#f59e0b">{data.model}</Pill>}
        {data.intent && <Pill>intent: {data.intent}</Pill>}
        {Array.isArray(data.sources) && data.sources.length > 0 && (
          <Pill>{data.sources.length} source{data.sources.length === 1 ? '' : 's'}</Pill>
        )}
      </div>
      <Collapsible label="System prompt" text={data.system_prompt} />
      <Collapsible label="User prompt / retrieved context" text={data.user_prompt} />
    </>
  );
}

function OutputBody({ data }) {
  const conf = typeof data.confidence === 'number' ? data.confidence : null;
  const confColor = conf == null ? null : conf >= 0.7 ? '#22c55e' : conf >= 0.4 ? '#f59e0b' : '#ef4444';
  const keyPoints = Array.isArray(data.key_points) ? data.key_points : [];
  const caveats = Array.isArray(data.caveats) ? data.caveats : [];
  return (
    <>
      <div className="ce-audit-tagrow">
        {data.answerProvenance && <Pill color={data.answerProvenance === 'inferred' ? '#22c55e' : '#94a3b8'}>{data.answerProvenance === 'inferred' ? 'AI-synthesized' : 'from context'}</Pill>}
        {conf != null && <Pill color={confColor}>confidence {(conf * 100).toFixed(0)}%</Pill>}
      </div>
      {data.headline && <p className="ce-audit-headline">{data.headline}</p>}
      {data.answer && <p className="ce-audit-answer">{data.answer}</p>}
      {keyPoints.length > 0 && (
        <Field label={`Key findings (${keyPoints.length})`}>
          <ul className="ce-audit-list">
            {keyPoints.map((kp, i) => (
              <li key={i}>{typeof kp === 'string' ? kp : kp.point}</li>
            ))}
          </ul>
        </Field>
      )}
      {caveats.length > 0 && (
        <Field label="Not established">
          <ul className="ce-audit-list ce-audit-list--muted">
            {caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Field>
      )}
    </>
  );
}

function ErrorBody({ data }) {
  return <p className="ce-audit-answer ce-audit-error-text">{data.error || data._text || 'Unknown error'}</p>;
}

function GenericBody({ data }) {
  return <pre className="ce-audit-pre">{prettyJson(data)}</pre>;
}

const BODIES = { user: UserBody, input: InputBody, output: OutputBody, error: ErrorBody, generic: GenericBody };

/* ── Single audit entry (a designed card, not a raw JSON dump) ─────────────── */
function AuditEntry({ entry, index }) {
  const [showRaw, setShowRaw] = useState(false);
  const stage = entry.stage ?? 'UNKNOWN';
  const meta = stageMeta(stage);
  const data = parsePayload(entry.payloadJson ?? entry.payload_json ?? entry.payload) ?? {};
  const Body = BODIES[meta.kind] ?? GenericBody;

  return (
    <div className="ce-audit-card" style={{ borderLeftColor: meta.color }}>
      <div className="ce-audit-card-head">
        <StageDot color={meta.color} />
        <span className="ce-audit-card-title">{meta.label}</span>
        <span className="ce-audit-step-no">{index + 1}</span>
        {meta.kind !== 'generic' && (
          <button
            type="button"
            className={`ce-audit-raw-toggle ${showRaw ? 'is-active' : ''}`}
            title={showRaw ? 'Hide raw payload' : 'Show raw payload'}
            onClick={() => setShowRaw((v) => !v)}
          >
            {'{ }'}
          </button>
        )}
      </div>
      <div className="ce-audit-card-body">
        {showRaw ? <pre className="ce-audit-pre">{prettyJson(data)}</pre> : <Body data={data} />}
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
  const { conversationId, apiClient } = useConvEngineChatContext();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

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

      <div className="ce-audit-scroll">
        {error && <p className="ce-audit-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="ce-audit-empty">No audit entries yet — ask a question to see how the answer was built.</p>
        )}
        {entries.map((entry, i) => (
          <AuditEntry key={entry.id ?? i} entry={entry} index={i} />
        ))}
      </div>
    </aside>
  );
}

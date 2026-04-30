import { useEffect, useState } from 'react';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';

/* ── Stage meta for coloured left-border ─────────────────────────────────── */
const STAGE_COLORS = {
  USER_INPUT: '#0ea5e9',
  ASSISTANT_OUTPUT: '#10b981',
  ENGINE_RETURN: '#84cc16',
  GUARDRAIL_ALLOW: '#10b981',
  GUARDRAIL_DENY: '#ef4444',
  GUARDRAIL_BLOCK: '#ef4444',
  POLICY_BLOCK: '#ef4444',
  MCP_TOOL_CALL: '#f97316',
  MCP_TOOL_RESULT: '#14b8a6',
  MCP_TOOL_ERROR: '#ef4444',
  MCP_FINAL_ANSWER: '#22c55e',
  PENDING_ACTION_EXECUTED: '#10b981',
  PENDING_ACTION_FAILED: '#ef4444',
  CORRECTION_STEP_RETRY_REQUESTED: '#f59e0b',
};

function stageColor(stage) {
  return STAGE_COLORS[stage] ?? '#94a3b8';
}

function formatPayload(raw) {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return String(raw);
  }
}

/* ── Single audit entry ───────────────────────────────────────────────────── */
function AuditEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const { ChevronDownIcon } = useIcons();
  const payload = formatPayload(entry.payloadJson ?? entry.payload_json ?? entry.payload);
  const stage = entry.stage ?? 'UNKNOWN';

  return (
    <div className="ce-audit-entry">
      <div
        className="ce-audit-entry-header"
        style={{ borderLeftColor: stageColor(stage) }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((v) => !v)}
      >
        <span className="ce-audit-stage">{stage}</span>
        {payload && (
          <ChevronDownIcon
            className={`ce-audit-chevron ${open ? 'ce-audit-chevron--open' : ''}`}
          />
        )}
      </div>

      {open && payload && (
        <pre className="ce-audit-payload">{payload}</pre>
      )}
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
          <p className="ce-audit-empty">No audit entries yet.</p>
        )}
        {entries.map((entry, i) => (
          <AuditEntry key={entry.id ?? i} entry={entry} />
        ))}
      </div>
    </aside>
  );
}

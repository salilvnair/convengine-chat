import { useEffect, useState } from 'react';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { ChevronDownIcon } from '../../icons/Icons.jsx';

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
export function AuditPanel({ auditRevision }) {
  const { conversationId, apiClient } = useConvEngineChatContext();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <aside className="ce-audit-panel" aria-label="Audit trail">
      <div className="ce-audit-panel-header">
        <span className="ce-audit-panel-title">Audit Trail</span>
        {loading && <span className="ce-audit-loading">Refreshing…</span>}
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

/**
 * Stage classification for the audit timeline.
 *
 * The engine's ConvEngineAuditStage enum has 100+ constants and keeps growing,
 * so this deliberately classifies by NAME SHAPE rather than listing every one:
 * a stage added to the engine tomorrow lands in the right family, with the
 * right colour and a readable label, without touching this file.
 *
 * Two dynamic forms have to survive the trip:
 *   - `intentResolvedBy(source)` builds INTENT_RESOLVED_BY_<SOURCE>
 *   - `withStage(sub)`           builds "NAME (sub)", e.g. "RULE_MATCH (RulesStep)"
 * Both are split here so the card shows a stable title with the variable part
 * as a separate badge, instead of rendering as an unknown stage each time.
 */

/* Family accents. Deliberately few: the eye should group stages, not decode
   a 12-colour legend. */
const FAMILY = {
  input:         { color: '#0ea5e9', label: 'Input' },
  dialogue:      { color: '#06b6d4', label: 'Dialogue act' },
  policy:        { color: '#8b5cf6', label: 'Policy' },
  intent:        { color: '#6366f1', label: 'Intent' },
  schema:        { color: '#14b8a6', label: 'Schema' },
  response:      { color: '#22c55e', label: 'Response' },
  agent:         { color: '#f59e0b', label: 'Agent' },
  sql:           { color: '#0891b2', label: 'SQL' },
  semantic:      { color: '#a855f7', label: 'Semantic' },
  rules:         { color: '#eab308', label: 'Rules' },
  orchestration: { color: '#ec4899', label: 'Orchestration' },
  lifecycle:     { color: '#94a3b8', label: 'Lifecycle' },
  error:         { color: '#ef4444', label: 'Error' },
};

/* Phrasing for the stages a reader actually stops on. Everything else falls
   through to humanize() — which is fine for SCHEMA_EXTRACTION_START, less fine
   for the handful below that deserve plain English. */
const LABELS = {
  USER_INPUT:                    'You asked',
  DIALOGUE_ACT_CLASSIFIED:       'Dialogue act',
  INTERACTION_POLICY_DECIDED:    'Interaction policy',
  GUARDRAIL_ALLOW:               'Guardrail: allowed',
  GUARDRAIL_DENY:                'Guardrail: denied',
  POLICY_BLOCK:                  'Blocked by policy',
  INTENT_RESOLVE_START:          'Resolving intent',
  INTENT_CLASSIFICATION_MATCHED: 'Intent matched',
  INTENT_CLASSIFIER_NO_MATCH:    'No intent matched',
  INTENT_MISSING:                'Intent missing',
  INTENT_RESOLVED_BY:            'Intent resolved',
  SCHEMA_STATUS:                 'Schema status',
  RESOLVE_RESPONSE:              'Resolving response',
  RESOLVE_RESPONSE_SELECTED:     'Response selected',
  RESOLVE_RESPONSE_LLM_INPUT:    'Sent to the model',
  RESOLVE_RESPONSE_LLM_OUTPUT:   'Model answer',
  ASSISTANT_OUTPUT:              'Assistant output',
  AGENT_PLAN_LLM_INPUT:          'Agent plan — prompt',
  AGENT_PLAN_LLM_OUTPUT:         'Agent plan',
  AGENT_TOOL_CALL:               'Tool call',
  AGENT_TOOL_RESULT:             'Tool result',
  AGENT_TOOL_ERROR:              'Tool error',
  AGENT_FINAL_ANSWER:            'Agent final answer',
  RULE_MATCH:                    'Rule matched',
  RULE_APPLIED:                  'Rule applied',
  RULE_NO_MATCH:                 'No rule matched',
  ENGINE_RETURN:                 'Engine return',
  PIPELINE_TIMING:               'Pipeline timing',
  CONVERSATION_RESET:            'Conversation reset',
  SQL_EXECUTED:                  'SQL executed',
  SQL_COMPILED:                  'SQL compiled',
  RESULT_SUMMARIZED:             'Result summarised',
  RUNTIME_ERROR:                 'Runtime error',
};

/** SCHEMA_EXTRACTION_START → "Schema extraction start" */
function humanize(stage) {
  const words = String(stage).toLowerCase().split('_').filter(Boolean);
  if (!words.length) return 'Step';
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
}

/** Splits "NAME (sub)" — the engine's withStage() form. */
function splitSubStage(stage) {
  const m = /^([^(]+?)\s*\(([^)]+)\)\s*$/.exec(String(stage ?? ''));
  return m ? { base: m[1].trim(), sub: m[2].trim() } : { base: String(stage ?? '').trim(), sub: null };
}

function familyOf(base) {
  // Errors win over their family: a failed tool call should read as a failure
  // first and an agent step second.
  if (/(_ERROR|_ERROR_|VIOLATION|_DENY|_REJECTED|_FAILED|^RUNTIME_ERROR|^POLICY_BLOCK)/.test(base)) return 'error';

  if (base === 'USER_INPUT') return 'input';
  if (base.startsWith('DIALOGUE_ACT')) return 'dialogue';

  // SQL before AGENT, so AGENT_DB_SQL_EXECUTION reads as SQL.
  if (/SQL|^DBKG_/.test(base)) return 'sql';
  if (base.startsWith('AGENT_')) return 'agent';
  if (base.startsWith('TOOL_ORCHESTRATION') || base.startsWith('STATE_GRAPH')) return 'orchestration';

  if (base.startsWith('INTENT_')) return 'intent';
  if (base.startsWith('SCHEMA_')) return 'schema';
  if (base.startsWith('RULE_')) return 'rules';
  if (/^(RESOLVE_RESPONSE|RESPONSE_|ASSISTANT_OUTPUT|EXACT_RESPONSE|AUTO_ADVANCE)/.test(base)) return 'response';
  if (/^(INTERACTION_POLICY|GUARDRAIL|PENDING_ACTION|DISAMBIGUATION|MEMORY_UPDATED)/.test(base)) return 'policy';
  if (/^(AST_|RETRIEVAL_|JOIN_PATH|GRAPH_TRAVERSED|RESULT_SUMMARIZED|STAGE_)/.test(base)) return 'semantic';

  return 'lifecycle';
}

/**
 * @returns {{ base, sub, label, color, family, familyLabel, isError }}
 */
export function stageMeta(stage) {
  let { base, sub } = splitSubStage(stage);

  // INTENT_RESOLVED_BY_CLASSIFIER → base INTENT_RESOLVED_BY, badge "CLASSIFIER".
  // Without this every source is its own unknown stage.
  const resolvedBy = /^INTENT_RESOLVED_BY_(.+)$/.exec(base);
  if (resolvedBy) {
    sub = sub ?? resolvedBy[1];
    base = 'INTENT_RESOLVED_BY';
  }

  const family = familyOf(base);
  const meta   = FAMILY[family] ?? FAMILY.lifecycle;

  return {
    base,
    sub,
    label:       LABELS[base] ?? humanize(base),
    color:       meta.color,
    family,
    familyLabel: meta.label,
    isError:     family === 'error',
  };
}

export { FAMILY as AUDIT_STAGE_FAMILIES };

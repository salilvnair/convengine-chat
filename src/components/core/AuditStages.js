/**
 * Stage classification for the audit timeline and the Audit Explorer.
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
   a 14-colour legend. `step` is the engine's STEP_ENTER / STEP_EXIT hook pair
   — over half of a real trail — kept pale so it recedes behind the stages
   that actually decided something. */
export const AUDIT_STAGE_FAMILIES = {
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
  step:          { color: '#cbd5e1', label: 'Step hooks' },
  error:         { color: '#ef4444', label: 'Failure' },
};

/* Phrasing for the stages a reader actually stops on. Everything else falls
   through to humanize() — which is fine for SCHEMA_EXTRACTION_START, less fine
   for the handful below that deserve plain English. */
export const AUDIT_STAGE_LABELS = {
  USER_INPUT:                    'You asked',
  DIALOGUE_ACT_CLASSIFIED:       'Dialogue act',
  DIALOGUE_ACT_LLM_INPUT:        'Dialogue act — prompt',
  DIALOGUE_ACT_LLM_OUTPUT:       'Dialogue act — reply',
  INTERACTION_POLICY_DECIDED:    'Interaction policy',
  GUARDRAIL_ALLOW:               'Guardrail: allowed',
  GUARDRAIL_DENY:                'Guardrail: denied',
  POLICY_BLOCK:                  'Blocked by policy',
  INTENT_RESOLVE_START:          'Resolving intent',
  INTENT_CLASSIFICATION_MATCHED: 'Intent matched',
  INTENT_CLASSIFIER_NO_MATCH:    'Classifier: no match',
  INTENT_MISSING:                'Intent missing',
  INTENT_RESOLVED_BY:            'Intent resolved',
  INTENT_AGENT_LLM_INPUT:        'Intent agent — prompt',
  INTENT_AGENT_LLM_OUTPUT:       'Intent agent — reply',
  SCHEMA_STATUS:                 'Schema status',
  SCHEMA_EXTRACTION_LLM_INPUT:   'Schema extraction — prompt',
  SCHEMA_EXTRACTION_LLM_OUTPUT:  'Schema extraction — reply',
  RESOLVE_RESPONSE:              'Resolving response',
  RESOLVE_RESPONSE_SELECTED:     'Response selected',
  RESOLVE_RESPONSE_LLM_INPUT:    'Response — prompt',
  RESOLVE_RESPONSE_LLM_OUTPUT:   'Response — reply',
  RESPONSE_MAPPING_NOT_FOUND:    'No response mapping',
  ASSISTANT_OUTPUT:              'Assistant output',
  AGENT_PLAN_LLM_INPUT:          'Agent plan — prompt',
  AGENT_PLAN_LLM_OUTPUT:         'Agent plan — reply',
  AGENT_TOOL_CALL:               'Tool call',
  AGENT_TOOL_RESULT:             'Tool result',
  AGENT_TOOL_ERROR:              'Tool error',
  AGENT_FINAL_ANSWER:            'Agent final answer',
  RULE_MATCH:                    'Rule matched',
  RULE_APPLIED:                  'Rule applied',
  RULE_NO_MATCH:                 'No rule matched',
  SET_STATE:                     'State changed',
  STEP_ENTER:                    'Step entered',
  STEP_EXIT:                     'Step exited',
  STEP_ERROR:                    'Step failed',
  PROMPT_RENDERING:              'Prompt rendered',
  MEMORY_UPDATED:                'Memory updated',
  ENGINE_RETURN:                 'Engine return',
  ENGINE_KNOWN_FAILURE:          'Engine failure (known)',
  ENGINE_UNKNOWN_FAILURE:        'Engine failure (unknown)',
  PIPELINE_TIMING:               'Pipeline timing',
  CONVERSATION_RESET:            'Conversation reset',
  SQL_EXECUTED:                  'SQL executed',
  SQL_COMPILED:                  'SQL compiled',
  RESULT_SUMMARIZED:             'Result summarised',
  RUNTIME_ERROR:                 'Runtime error',
};

/*
 * Failures vs warnings.
 *
 * FAILURE is the engine not being able to finish what it started. The
 * previous pattern caught _ERROR and _FAILED but not FAILURE or NOT_FOUND, so
 * ENGINE_KNOWN_FAILURE, ENGINE_UNKNOWN_FAILURE and RESPONSE_MAPPING_NOT_FOUND
 * — the stages that end a turn with no reply — rendered in neutral grey. Real
 * captures from ConvEngine 2.0.28 contain all three.
 *
 * WARNING is the engine working as designed and saying no: a candidate intent
 * REJECTED, a classifier NO_MATCH, a step SKIPPED. The old pattern put
 * _REJECTED under errors, which painted routine intent-agent scoring red.
 */
const FAIL_RE = /(_ERROR$|_ERROR_|FAILURE|_FAILED$|VIOLATION|_DENY$|NOT_FOUND|^POLICY_BLOCK$|^RUNTIME_ERROR$)/;
const WARN_RE = /(REJECTED|NO_MATCH|_SKIPPED|MISSING|COLLISION|NEEDS_CLARIFICATION|SUPPRESSED)/;
const LLM_RE  = /_LLM_(INPUT|OUTPUT|ERROR)$/;

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
  // Failures win over their family: a failed tool call should read as a
  // failure first and an agent step second.
  if (FAIL_RE.test(base)) return 'error';
  if (base === 'STEP_ENTER' || base === 'STEP_EXIT') return 'step';

  if (base === 'USER_INPUT') return 'input';
  if (base.startsWith('DIALOGUE_ACT')) return 'dialogue';

  // SQL before AGENT, so AGENT_DB_SQL_EXECUTION reads as SQL.
  if (/SQL|^DBKG_/.test(base)) return 'sql';
  if (base.startsWith('AGENT_')) return 'agent';
  if (base.startsWith('TOOL_ORCHESTRATION') || base.startsWith('STATE_GRAPH')) return 'orchestration';

  if (base.startsWith('INTENT_')) return 'intent';
  if (base.startsWith('SCHEMA_') || base.startsWith('AUTO_ADVANCE')) return 'schema';
  if (base.startsWith('RULE_') || base === 'SET_STATE') return 'rules';
  if (/^(RESOLVE_RESPONSE|RESPONSE_|ASSISTANT_OUTPUT|EXACT_RESPONSE)/.test(base)) return 'response';
  if (/^(INTERACTION_POLICY|GUARDRAIL|PENDING_ACTION|DISAMBIGUATION|MEMORY_UPDATED)/.test(base)) return 'policy';
  if (/^(AST_|RETRIEVAL_|JOIN_PATH|GRAPH_TRAVERSED|RESULT_SUMMARIZED|STAGE_)/.test(base)) return 'semantic';

  return 'lifecycle';
}

/**
 * @param {string} stage  the raw stage string as the engine wrote it
 * @param {object} [overrides]
 * @param {Record<string,string>} [overrides.labels]        stage base → label
 * @param {Record<string,string>} [overrides.familyColors]  family → colour
 * @param {(base: string) => string|null} [overrides.classify]
 *        return a family key to take over classification, or null to defer
 * @returns {{ base, sub, label, color, family, familyLabel, isError, severity, isLlm }}
 *   severity is 'error' | 'warn' | null
 */
export function stageMeta(stage, overrides) {
  let { base, sub } = splitSubStage(stage);

  // INTENT_RESOLVED_BY_CLASSIFIER → base INTENT_RESOLVED_BY, badge "CLASSIFIER".
  // Without this every source is its own unknown stage.
  const resolvedBy = /^INTENT_RESOLVED_BY_(.+)$/.exec(base);
  if (resolvedBy) {
    sub = sub ?? resolvedBy[1];
    base = 'INTENT_RESOLVED_BY';
  }

  const custom = overrides?.classify?.(base);
  const family = custom && AUDIT_STAGE_FAMILIES[custom] ? custom : familyOf(base);
  const fam    = AUDIT_STAGE_FAMILIES[family] ?? AUDIT_STAGE_FAMILIES.lifecycle;
  const severity = family === 'error' ? 'error' : (WARN_RE.test(base) ? 'warn' : null);

  return {
    base,
    sub,
    label:       overrides?.labels?.[base] ?? AUDIT_STAGE_LABELS[base] ?? humanize(base),
    color:       overrides?.familyColors?.[family] ?? fam.color,
    family,
    familyLabel: fam.label,
    isError:     severity === 'error',
    severity,
    isLlm:       LLM_RE.test(base),
  };
}

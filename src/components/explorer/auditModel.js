import { stageMeta } from '../core/AuditStages.js';

/**
 * Turns raw audit rows — the engine's CeAudit JSON, one row per stage — into
 * what the Audit Explorer reads: conversations, turns and pipeline steps.
 *
 * Everything here is derived from the rows alone. A real ConvEngine row
 * carries a `_meta` envelope (intent/state at the time, the session snapshot,
 * the accumulating inputParams, stepInfos); rows from a backend without it
 * still work, they just have less to show.
 */

function parse(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object') return raw;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : { _text: String(v) };
  } catch {
    return { _text: String(raw) };
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @param {Array} apiRows  CeAudit rows: { auditId, conversationId, stage, payloadJson, createdAt }
 * @param {object} [overrides]  passed through to stageMeta (labels, familyColors, classify)
 */
export function normalizeRows(apiRows, overrides) {
  const sorted = [...(apiRows ?? [])].sort((a, b) => {
    if (a.conversationId !== b.conversationId) return String(a.conversationId).localeCompare(String(b.conversationId));
    return Number(a.auditId ?? a.id ?? 0) - Number(b.auditId ?? b.id ?? 0);
  });

  const firstAt = {};
  const turnOf = {};
  const stepOf = {};
  const prev = {};
  // A turn starts when the pipeline starts, not at USER_INPUT: the engine runs
  // LoadOrCreateConversation, ResetConversation and PersistConversationBootstrap
  // BEFORE AuditUserInputStep writes USER_INPUT. Keying turns off USER_INPUT
  // filed those three steps under the previous turn — turn 1 showed 30 steps,
  // the last three belonging to turn 2. So the first step name seen in a
  // conversation marks every turn boundary; backends without step hooks fall
  // back to USER_INPUT.
  const firstStep = {};
  const sawStepHooks = {};

  return sorted.map((raw) => {
    const cid = String(raw.conversationId ?? '');
    const payloadText = typeof raw.payloadJson === 'string'
      ? raw.payloadJson
      : JSON.stringify(raw.payloadJson ?? raw.payload ?? {});
    const parsed = parse(raw.payloadJson ?? raw.payload_json ?? raw.payload);
    const { _meta: metaEnv = null, ...body } = parsed;
    const m = stageMeta(raw.stage, overrides);

    if (m.base === 'STEP_ENTER') {
      sawStepHooks[cid] = true;
      if (firstStep[cid] == null) firstStep[cid] = body.step;
      if (body.step === firstStep[cid]) turnOf[cid] = (turnOf[cid] ?? 0) + 1;
      stepOf[cid] = body.step ?? stepOf[cid];
    }
    if (m.base === 'USER_INPUT' && !sawStepHooks[cid]) turnOf[cid] = (turnOf[cid] ?? 0) + 1;
    const step = stepOf[cid] ?? null;

    const at = raw.createdAt ?? raw.created_at ?? metaEnv?.emittedAt ?? null;
    const t = at ? Date.parse(at) : NaN;
    if (!(cid in firstAt) && !Number.isNaN(t)) firstAt[cid] = t;

    const intent = metaEnv?.intent ?? null;
    const state = metaEnv?.state ?? null;
    const p = prev[cid];

    // inputParams accumulate as the pipeline runs, so the useful fact per row
    // is what THIS row changed, not the whole bag again.
    const ipNow = metaEnv?.inputParams ?? null;
    const ipBefore = p?.inputParams ?? {};
    const ipSet = {};
    const ipRemoved = [];
    if (ipNow) {
      for (const [k, v] of Object.entries(ipNow)) if (!same(ipBefore[k], v)) ipSet[k] = v;
      for (const k of Object.keys(ipBefore)) if (!(k in ipNow)) ipRemoved.push(k);
    }

    const stepInfos = metaEnv?.session?.stepInfos ?? null;
    const row = {
      id: raw.auditId ?? raw.id,
      cid,
      stage: raw.stage,
      at,
      t,
      off: Number.isNaN(t) || !(cid in firstAt) ? 0 : t - firstAt[cid],
      turn: turnOf[cid] ?? 1,
      step,
      m,
      body,
      meta: metaEnv,
      stepInfo: step && stepInfos ? stepInfos[step] ?? null : null,
      stepsSoFar: stepInfos ? Object.keys(stepInfos).length : 0,
      inputParams: ipNow,
      ipSet,
      ipRemoved,
      ipChanged: !!ipNow && (Object.keys(ipSet).length > 0 || ipRemoved.length > 0),
      intent,
      state,
      intentChanged: !!p && p.intent !== intent,
      stateChanged: !!p && p.state !== state,
      bytes: payloadText.length,
      // Search matches the stage and the BODY, never _meta: the envelope names
      // every step run so far and repeats the user's text, so matching it makes
      // every later row in the conversation a hit.
      hay: `${raw.stage} ${JSON.stringify(body)}`.toLowerCase(),
      raw,
    };

    if (m.base === 'STEP_EXIT' || m.base === 'STEP_ERROR') stepOf[cid] = null;
    prev[cid] = row;
    return row;
  });
}

/** Groups rows into conversations → turns → steps. Newest conversation first. */
export function buildConversations(rows) {
  const byCid = new Map();
  rows.forEach((r) => {
    if (!byCid.has(r.cid)) byCid.set(r.cid, []);
    byCid.get(r.cid).push(r);
  });

  const convs = [...byCid.entries()].map(([cid, crows]) => {
    const byTurn = new Map();
    crows.forEach((r) => {
      if (!byTurn.has(r.turn)) byTurn.set(r.turn, []);
      byTurn.get(r.turn).push(r);
    });

    const turns = [...byTurn.entries()].map(([n, trs]) => {
      const user = trs.find((r) => r.m.base === 'USER_INPUT')?.body?.text ?? '';
      const out = trs.find((r) => r.m.base === 'ASSISTANT_OUTPUT')?.body?.output ?? null;
      const fail = trs.find((r) => r.m.severity === 'error') ?? null;
      const timing = trs.find((r) => r.m.base === 'PIPELINE_TIMING')?.body?.totalMs;

      const steps = [];
      trs.forEach((r) => {
        if (r.m.base !== 'STEP_EXIT' && r.m.base !== 'STEP_ERROR') return;
        const name = r.body?.step ?? r.step ?? 'Step';
        const inner = trs.filter((x) => x.step === name && x.m.family !== 'step');
        steps.push({
          name,
          ms: Number(r.body?.durationMs) || 0,
          enter: trs.find((x) => x.m.base === 'STEP_ENTER' && x.body?.step === name) ?? null,
          exit: r,
          llm: inner.some((x) => x.m.isLlm),
          err: r.m.base === 'STEP_ERROR' || inner.some((x) => x.m.severity === 'error'),
        });
      });

      const ms = typeof timing === 'number' ? timing : steps.reduce((a, s) => a + s.ms, 0);
      return { n, rows: trs, user, out, fail, ms, steps };
    }).sort((a, b) => a.n - b.n);

    const fail = turns.find((t) => t.fail)?.fail ?? null;
    return {
      cid,
      rows: crows,
      turns,
      fail,
      ok: !fail,
      first: turns[0]?.user ?? '',
      latest: Math.max(...crows.map((r) => (Number.isNaN(r.t) ? 0 : r.t))),
    };
  });

  return convs.sort((a, b) => b.latest - a.latest);
}

/** The prompt/reply partner of an LLM row, within the same turn. */
export function llmPairOf(row, rows) {
  const m = /^(.*)_LLM_(INPUT|OUTPUT)$/.exec(row.m.base);
  if (!m) return null;
  const want = `${m[1]}_LLM_${m[2] === 'INPUT' ? 'OUTPUT' : 'INPUT'}`;
  const turnRows = rows.filter((x) => x.cid === row.cid && x.turn === row.turn);
  const idx = turnRows.indexOf(row);
  // Nearest partner in the right direction — a turn can call the same model twice.
  const partner = m[2] === 'INPUT'
    ? turnRows.slice(idx + 1).find((x) => x.m.base === want)
    : [...turnRows.slice(0, idx)].reverse().find((x) => x.m.base === want);
  return m[2] === 'INPUT'
    ? { input: row, output: partner ?? null }
    : { input: partner ?? null, output: row };
}

/** Every row written inside the same pipeline step as `row`. */
export function stepRowsOf(row, rows) {
  if (!row.step) return [];
  return rows.filter((x) => x.cid === row.cid && x.turn === row.turn && x.step === row.step);
}

export function tryParseJson(value) {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return value;
  try { return JSON.parse(t); } catch { return value; }
}

export const DEFAULT_FILTERS = {
  q: '',
  outcome: 'all',        // 'all' | 'ok' | 'fail'
  conversations: [],
  families: [],
  intents: [],
  states: [],
  hideSteps: true,
  errorsOnly: false,
  llmOnly: false,
  changedOnly: false,
  inputParamsChanged: false,
  minPayloadKb: 0,
};

/**
 * Client-side filter. `skip` names one facet to ignore, so a facet's counts
 * show what picking it would give you with every OTHER filter applied.
 */
/**
 * A pasted conversation id, whole or its first 8+ characters.
 *
 * The id lives on the row, not in the stage or body that text search reads,
 * so without this a search for a conversation id found nothing at all. Kept
 * strict (hex and dashes, 8+ chars) so an ordinary word never gets read as an
 * id prefix.
 */
export function looksLikeConversationId(q) {
  return /^[0-9a-f]{8}[0-9a-f-]{0,28}$/i.test(String(q ?? '').trim());
}
export function isFullConversationId(q) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(q ?? '').trim());
}

export function rowPasses(r, F, convOk, skip) {
  if (F.q) {
    const q = F.q.toLowerCase();
    if (looksLikeConversationId(q) ? !r.cid.toLowerCase().startsWith(q) : !r.hay.includes(q)) return false;
  }
  if (skip !== 'conversations' && F.conversations.length && !F.conversations.includes(r.cid)) return false;
  if (F.outcome !== 'all') {
    const ok = convOk.get(r.cid);
    if (F.outcome === 'ok' ? !ok : ok) return false;
  }
  if (skip !== 'families' && F.families.length && !F.families.includes(r.m.family)) return false;
  if (skip !== 'intents' && F.intents.length && !F.intents.includes(r.intent ?? '—')) return false;
  if (skip !== 'states' && F.states.length && !F.states.includes(r.state ?? '—')) return false;
  if (F.hideSteps && r.m.family === 'step' && skip !== 'families') return false;
  if (F.errorsOnly && r.m.severity !== 'error') return false;
  if (F.llmOnly && !r.m.isLlm) return false;
  if (F.changedOnly && !(r.intentChanged || r.stateChanged)) return false;
  if (F.inputParamsChanged && !r.ipChanged) return false;
  if (F.minPayloadKb && r.bytes < F.minPayloadKb * 1024) return false;
  return true;
}

export const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`);
export const fmtBytes = (b) => (b >= 1024 ? `${(b / 1024).toFixed(b >= 10240 ? 0 : 1)}K` : `${b}B`);

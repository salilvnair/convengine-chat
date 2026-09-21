import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient } from '../../api/client.js';
import { AUDIT_STAGE_FAMILIES } from '../core/AuditStages.js';
import { COLOR_SHORTHANDS, PALETTE_VARS, resolvePalette } from './palettes.js';
import {
  DEFAULT_FILTERS,
  buildConversations,
  fmtBytes,
  fmtMs,
  isFullConversationId,
  llmPairOf,
  normalizeRows,
  rowPasses,
  stepRowsOf,
  tryParseJson,
} from './auditModel.js';

/**
 * AuditExplorer — a full-page search and inspection UI for ConvEngine audit
 * trails. Where the in-chat AuditPanel shows one conversation, this answers
 * "what went in, what came out, and why" across many.
 *
 * Data: `config.rows` for static data, otherwise it asks
 * GET {audit}/search for which conversations match, then loads each one's full
 * trail with GET {audit}/{conversationId}. The second step is not optional —
 * pairing a prompt with its reply, or showing what a step changed, needs the
 * whole turn, not just the rows that matched.
 *
 * Styling follows ConvEngineChat: `config` colour shorthands accept a string or
 * { light, dark }, and the `theme` prop overrides any --ce-ax-* variable
 * (keys are auto-prefixed with --ce-).
 */

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap';

const TABS = {
  io:   'In → Out',
  body: 'Body',
  meta: 'Metadata',
  raw:  'Raw',
};

/* ── Small helpers ───────────────────────────────────────────────────────── */

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Escaped first, then keys / strings / literals wrapped — never raw input. */
function jsonHtml(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return esc(text)
    .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="ce-ax-k">$1</span>$2')
    .replace(/(:\s*)(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '$1<span class="ce-ax-s">$2</span>')
    .replace(/(:\s*)(-?\d+(?:\.\d+)?|true|false|null)/g, '$1<span class="ce-ax-num">$2</span>');
}

function Code({ value, tall }) {
  const v = typeof value === 'string' ? tryParseJson(value) : value;
  return <pre className={`ce-ax-pre${tall ? ' is-tall' : ''}`} dangerouslySetInnerHTML={{ __html: jsonHtml(v) }} />;
}

function Field({ name, value }) {
  if (value == null || value === '') return null;
  const parsed = tryParseJson(value);
  return (
    <div className="ce-ax-field">
      <span>{name}</span>
      {typeof parsed === 'object' ? <Code value={parsed} /> : <pre className="ce-ax-pre">{String(parsed)}</pre>}
    </div>
  );
}

function KV({ k, v, changed }) {
  if (v == null || v === '') return null;
  return (
    <span className={`ce-ax-kv${changed ? ' is-changed' : ''}`}>
      <i>{k}</i><b>{String(v)}</b>
    </span>
  );
}

const shortId = (cid) => String(cid).slice(0, 8);
const sessionPointer = (v) => (v && typeof v === 'object' && 'stepInfos' in v ? '(session snapshot — see Metadata)' : v);
const stripSession = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, k === 'session' ? sessionPointer(v) : v]));

function resolveColor(value, dark) {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  return (dark ? value.dark : value.light) || null;
}

function useScheme(pref, defaultDark) {
  const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [systemDark, setSystemDark] = useState(() => media?.matches ?? false);
  useEffect(() => {
    if (!media) return undefined;
    const on = (e) => setSystemDark(e.matches);
    media.addEventListener?.('change', on);
    return () => media.removeEventListener?.('change', on);
  }, [media]);
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (defaultDark != null && pref == null) return !!defaultDark;
  return systemDark;
}

/* ── Component ───────────────────────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {import('../../../index.d.ts').AuditExplorerConfig} [props.config]
 * @param {Record<string,string>} [props.theme]  CSS variable overrides (auto-prefixed --ce-)
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export function AuditExplorer({ config = {}, theme = {}, className = '', style }) {
  const {
    apiHost = '',
    apiEndpoints,
    rows: staticRows,
    conversationId: linkedConversation,
    conversationIds = [],
    initialQuery = '',
    limit = 200,
    maxConversations = 12,
    searchPageLimit = 5,
    defaultFilters,
    title = 'Audit Explorer',
    subtitle,
    showSearch = true,
    showKpis = true,
    showApiReadout = true,
    showFilters = true,
    showWaterfall = true,
    showInspector = true,
    showRefresh = true,
    inspectorTabs = ['io', 'body', 'meta', 'raw'],
    defaultTab = 'io',
    keyboardShortcuts = true,
    loadFonts = true,
    palette = 'aurora',
    paletteBase = 'aurora',
    colorScheme,
    defaultDark,
    fontFamily,
    monoFontFamily,
    height = '100%',
    stageLabels,
    familyColors,
    classifyStage,
    showLanding = true,
    landingTitle = 'Search your conversations',
    landingSubtitle = 'Find any turn by what was said, a stage name, or a conversation id — then see what went into the model, what came out, and what every pipeline step changed.',
    landingRecentLimit = 9,
    landingQuickFilters = true,
    landingExamples = ['SCHEMA_STATUS', 'RULE_MATCH', 'INTENT_AGENT', 'failure'],
    onViewChange,
    onSelectRow,
    onFiltersChange,
    onError,
  } = config;

  const dark = useScheme(colorScheme, defaultDark);
  const api = useMemo(
    () => createApiClient(apiHost, apiEndpoints ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiHost, JSON.stringify(apiEndpoints ?? {})],
  );
  const overrides = useMemo(
    () => ({ labels: stageLabels, familyColors, classify: classifyStage }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(stageLabels ?? {}), JSON.stringify(familyColors ?? {}), classifyStage],
  );

  // The explorer ships in the Plex faces the design was drawn in; opt out with
  // loadFonts: false (a strict CSP, or your own fonts via fontFamily).
  useEffect(() => {
    if (!loadFonts || typeof document === 'undefined') return;
    if (document.querySelector('link[data-ce-ax-fonts]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    link.setAttribute('data-ce-ax-fonts', '');
    document.head.appendChild(link);
  }, [loadFonts]);

  const [F, setF] = useState(() => ({
    ...DEFAULT_FILTERS,
    ...(defaultFilters ?? {}),
    q: initialQuery || defaultFilters?.q || '',
  }));
  const [qInput, setQInput] = useState(F.q);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [total, setTotal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState(inspectorTabs.includes(defaultTab) ? defaultTab : inspectorTabs[0]);
  const [reloadKey, setReloadKey] = useState(0);
  // Open on the landing page unless the caller already knows what to show.
  const [view, setView] = useState(() => (showLanding && !linkedConversation && !initialQuery ? 'landing' : 'explore'));
  const trailCache = useRef(new Map());
  const searchRef = useRef(null);
  const rootRef = useRef(null);

  const setFilters = useCallback((patch) => {
    setF((prev) => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      onFiltersChange?.(next);
      return next;
    });
  }, [onFiltersChange]);

  // Typing is debounced; everything else applies at once.
  useEffect(() => {
    if (view !== 'explore') return undefined;
    const t = setTimeout(() => setFilters({ q: qInput.trim() }), 300);
    return () => clearTimeout(t);
  }, [qInput, setFilters, view]);

  /* Server-side subset of the filters — what GET /audit/search can do. */
  const serverParams = useMemo(() => {
    const p = {};
    if (F.conversations.length === 1) p.conversationId = F.conversations[0];
    if (F.intents.length === 1 && F.intents[0] !== '—') p.intent = F.intents[0];
    if (F.states.length === 1 && F.states[0] !== '—') p.state = F.states[0];
    if (F.errorsOnly) p.errorsOnly = true;
    return p;
  }, [F.conversations, F.intents, F.states, F.errorsOnly]);

  /* ── Load ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (staticRows) {
      setRawRows(staticRows);
      setTotal(staticRows.length);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotice(null);
      try {
        let cids = [];
        let searchTotal = null;
        const byId = isFullConversationId(F.q) ? F.q.trim().toLowerCase() : null;
        try {
          if (byId) throw Object.assign(new Error('by-id'), { byId: true });
          // Search returns ROWS, and one real conversation is ~85 of them, so a
          // single page of 200 names only two or three conversations. Page on
          // until there are enough distinct conversations to fill the view,
          // the rows run out, or searchPageLimit pages have been read.
          for (let page = 0, offset = 0; page < searchPageLimit; page += 1) {
            const { results, total: t } = await api.searchAudit(F.q, { limit, offset, ...serverParams });
            searchTotal = t;
            for (const r of results) {
              const cid = String(r.conversationId);
              if (!cids.includes(cid)) cids.push(cid);
            }
            offset += results.length;
            if (cids.length >= maxConversations || results.length < limit || offset >= t) break;
          }
        } catch (err) {
          if (err.byId) {
            // A whole conversation id needs no search: load it directly. This
            // also works against a backend with no search endpoint at all.
            cids = [byId];
          } else {
          // No search route on this backend (ConvEngine 2.x ships none): the
          // engine answers /audit/search with 400, because it tries to read
          // "search" as a conversation UUID. Degrade to the linked
          // conversations instead of showing nothing.
          setNotice(linkedConversation || conversationIds.length
            ? 'This backend has no audit search endpoint, so only the linked conversation is shown. See “Audit search endpoint” in the convengine-chat README to add one.'
            : 'This backend has no audit search endpoint yet. Paste a full conversation id to open one directly, or add the endpoint — see “Audit search endpoint” in the convengine-chat README.');
          }
        }
        const pinned = [linkedConversation, ...conversationIds].filter(Boolean).map(String);
        cids = [...pinned, ...cids.filter((c) => !pinned.includes(c))].slice(0, Math.max(maxConversations, pinned.length));

        const trails = await Promise.all(cids.map(async (cid) => {
          if (trailCache.current.has(cid)) return trailCache.current.get(cid);
          const data = await api.fetchAudit(cid);
          const list = Array.isArray(data) ? data : (data?.entries ?? []);
          trailCache.current.set(cid, list);
          return list;
        }));
        if (cancelled) return;
        setRawRows(trails.flat());
        setTotal(searchTotal);
      } catch (err) {
        if (cancelled) return;
        setNotice(`Could not load audit data: ${err.message}`);
        onError?.(err);
        setRawRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, staticRows, F.q, serverParams, limit, maxConversations, searchPageLimit, linkedConversation, JSON.stringify(conversationIds), reloadKey]);

  const rows = useMemo(() => normalizeRows(rawRows, overrides), [rawRows, overrides]);
  const convs = useMemo(() => buildConversations(rows), [rows]);
  const convOk = useMemo(() => new Map(convs.map((c) => [c.cid, c.ok])), [convs]);
  const visible = useMemo(() => rows.filter((r) => rowPasses(r, F, convOk)), [rows, F, convOk]);
  const visibleSet = useMemo(() => new Set(visible), [visible]);

  // Default selection: the linked conversation's first model reply, else the
  // first reply anywhere, else the first visible row — the In → Out view is
  // the point of the page, so open on something it can show.
  const selected = useMemo(() => {
    const byId = rows.find((r) => r.id === selectedId);
    if (byId) return byId;
    const pool = linkedConversation ? rows.filter((r) => r.cid === String(linkedConversation)) : rows;
    return pool.find((r) => r.m.isLlm && /_OUTPUT$/.test(r.m.base) && visibleSet.has(r))
      ?? pool.find((r) => visibleSet.has(r))
      ?? visible[0]
      ?? null;
  }, [rows, selectedId, linkedConversation, visible, visibleSet]);

  const select = useCallback((row, scroll) => {
    if (!row) return;
    if (!visibleSet.has(row) && row.m.family === 'step') setFilters({ hideSteps: false });
    setSelectedId(row.id);
    onSelectRow?.(row.raw);
    if (scroll) {
      requestAnimationFrame(() => rootRef.current?.querySelector(`[data-ax-row="${row.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
  }, [visibleSet, setFilters, onSelectRow]);

  /* ── Keyboard ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!keyboardShortcuts) return undefined;
    const onKey = (e) => {
      if (!rootRef.current) return;
      if (e.target.matches?.('input, textarea, select')) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      if (e.key === '/' && showSearch) { e.preventDefault(); searchRef.current?.focus(); return; }
      const down = e.key === 'j' || e.key === 'ArrowDown';
      const up = e.key === 'k' || e.key === 'ArrowUp';
      if (!down && !up) return;
      const i = visible.indexOf(selected);
      const next = visible[Math.min(visible.length - 1, Math.max(0, i + (down ? 1 : -1)))];
      if (next) { e.preventDefault(); select(next, true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [keyboardShortcuts, showSearch, visible, selected, select]);

  /* ── Styles: tokens, config colours, theme overrides ───────────────────── */
  const rootStyle = useMemo(() => {
    const s = { height };
    if (fontFamily) s['--ce-ax-sans'] = fontFamily;
    if (monoFontFamily) s['--ce-ax-mono'] = monoFontFamily;
    // Palette first, then colour shorthands, then the theme prop — the same
    // precedence ConvEngineChat uses, so the most specific setting wins.
    const pal = resolvePalette(palette, dark, paletteBase);
    for (const [key, cssVar] of Object.entries(PALETTE_VARS)) {
      if (pal[key]) s[cssVar] = pal[key];
    }
    for (const [shorthand, key] of Object.entries(COLOR_SHORTHANDS)) {
      const v = resolveColor(config[shorthand], dark);
      if (v) s[PALETTE_VARS[key]] = v;
    }
    for (const [key, value] of Object.entries(theme ?? {})) {
      s[key.startsWith('--') ? key : `--ce-${key}`] = value;
    }
    return { ...s, ...(style ?? {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, fontFamily, monoFontFamily, dark, JSON.stringify(palette), paletteBase, JSON.stringify(theme), style, ...Object.keys(COLOR_SHORTHANDS).map((k) => JSON.stringify(config[k] ?? null))]);

  const layout = [showFilters && 'f', 'm', showInspector && 'i'].filter(Boolean).join('');

  /** Leave the landing page for the explorer, optionally applying filters. */
  const explore = useCallback((patch) => {
    if (patch) setFilters(patch);
    if (patch?.q != null) setQInput(patch.q);
    setView('explore');
    onViewChange?.('explore');
  }, [setFilters, onViewChange]);
  const goHome = useCallback(() => {
    setView('landing');
    onViewChange?.('landing');
  }, [onViewChange]);

  const rootProps = {
    ref: rootRef,
    className: `ce-ax ${className}`,
    'data-ce-ax-scheme': dark ? 'dark' : 'light',
    'data-ce-ax-layout': layout,
    'data-ce-ax-view': view,
    'data-ce-ax-palette': typeof palette === 'string' ? palette : 'custom',
    style: rootStyle,
  };

  if (view === 'landing') {
    return (
      <div {...rootProps}>
        {notice && <div className="ce-ax-notice" role="status">{notice}</div>}
        <Landing
          title={landingTitle}
          subtitle={landingSubtitle}
          qInput={qInput}
          setQInput={setQInput}
          onSearch={() => explore({ q: qInput.trim() })}
          onQuick={explore}
          onOpenConversation={(cid) => explore({ ...DEFAULT_FILTERS, ...(defaultFilters ?? {}), q: '', conversations: [cid] })}
          convs={convs}
          rows={rows}
          loading={loading}
          recentLimit={landingRecentLimit}
          showQuick={landingQuickFilters}
          examples={landingExamples}
          searchRef={searchRef}
          keyboardShortcuts={keyboardShortcuts}
        />
      </div>
    );
  }

  return (
    <div {...rootProps}>
      <header className="ce-ax-top">
        {showLanding && (
          <button type="button" className="ce-ax-home" onClick={goHome} title="Back to search">← Search</button>
        )}
        <div className="ce-ax-brand">
          <span className="ce-ax-mark" aria-hidden="true" />
          <h1>{title}</h1>
          <span className="ce-ax-src">{subtitle ?? sourceLine(rows, convs, total, staticRows)}</span>
        </div>
        {showSearch && (
          <label className="ce-ax-search" htmlFor="ce-ax-q">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              id="ce-ax-q"
              ref={searchRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search stages and payloads — loan, SCHEMA_STATUS, income…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
            {keyboardShortcuts && <kbd>/</kbd>}
          </label>
        )}
        {showKpis && <Kpis visible={visible} rows={rows} convs={convs} />}
        {showRefresh && !staticRows && (
          <button
            type="button"
            className="ce-ax-chip"
            onClick={() => { trailCache.current.clear(); setReloadKey((k) => k + 1); }}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </header>

      {notice && <div className="ce-ax-notice" role="status">{notice}</div>}
      {showApiReadout && <ApiReadout F={F} rows={rows} serverParams={serverParams} limit={limit} staticRows={!!staticRows} />}

      <div className="ce-ax-panes">
        {showFilters && (
          <aside className="ce-ax-pane ce-ax-filters" aria-label="Filters">
            <div className="ce-ax-pane-h">
              <h2>Filters</h2><span className="ce-ax-grow" />
              <button type="button" className="ce-ax-chip" onClick={() => { setQInput(''); setFilters({ ...DEFAULT_FILTERS, ...(defaultFilters ?? {}), q: '' }); }}>Reset</button>
            </div>
            <div className="ce-ax-scroll ce-ax-filter-body">
              <FiltersBody F={F} setFilters={setFilters} rows={rows} convs={convs} convOk={convOk} />
            </div>
          </aside>
        )}

        <main className="ce-ax-pane ce-ax-timeline" aria-label="Timeline">
          {showWaterfall && <Waterfall convs={convs} selected={selected} onJump={(r) => select(r, true)} />}
          <div className="ce-ax-scroll" tabIndex={-1}>
            <Timeline convs={convs} visibleSet={visibleSet} selected={selected} onSelect={(r) => select(r, false)} loading={loading} />
          </div>
        </main>

        {showInspector && (
          <section className="ce-ax-pane ce-ax-insp" aria-label="Inspector">
            <Inspector
              row={selected}
              rows={rows}
              convs={convs}
              tab={tab}
              tabs={inspectorTabs}
              onTab={setTab}
              onJump={(r) => select(r, true)}
            />
          </section>
        )}
      </div>
    </div>
  );
}

function sourceLine(rows, convs, total, isStatic) {
  if (!rows.length) return isStatic ? 'No rows' : 'Waiting for audit rows';
  const matched = total != null ? ` · ${total.toLocaleString()} matching rows on the server` : '';
  return `${rows.length.toLocaleString()} rows loaded · ${convs.length} conversation${convs.length === 1 ? '' : 's'}${matched}`;
}

/* ── Search landing ──────────────────────────────────────────────────────── */

function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function Landing({
  title, subtitle, qInput, setQInput, onSearch, onQuick, onOpenConversation,
  convs, rows, loading, recentLimit, showQuick, examples, searchRef, keyboardShortcuts,
}) {
  const failedConvs = convs.filter((c) => !c.ok).length;
  const llmCalls = rows.filter((r) => r.m.isLlm).length;
  const stateChanges = rows.filter((r) => r.stateChanged || r.intentChanged).length;
  const recent = convs.slice(0, recentLimit);

  return (
    <div className="ce-ax-landing">
      <div className="ce-ax-landing-inner">
        <div className="ce-ax-hero">
          <span className="ce-ax-mark" aria-hidden="true" />
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <form
          className="ce-ax-search is-hero"
          role="search"
          onSubmit={(e) => { e.preventDefault(); onSearch(); }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            id="ce-ax-q"
            ref={searchRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            aria-label="Search audit trails"
            placeholder="What the user said, a stage, or a conversation id…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          {keyboardShortcuts && <kbd>↵</kbd>}
          <button type="submit">Search</button>
        </form>

        {examples?.length > 0 && (
          <div className="ce-ax-try">
            <span>Try</span>
            {examples.map((ex) => (
              <button key={ex} type="button" className="ce-ax-chip is-mono" onClick={() => onQuick({ q: ex })}>{ex}</button>
            ))}
          </div>
        )}

        {showQuick && (
          <div className="ce-ax-quick">
            <button type="button" onClick={() => onQuick({ outcome: 'fail', hideSteps: true })}>
              <span className={`ce-ax-qn${failedConvs ? ' is-err' : ''}`}>{failedConvs}</span>
              <b>Failed conversations</b>
              <span>Turns that ended without a reply</span>
            </button>
            <button type="button" onClick={() => onQuick({ llmOnly: true })}>
              <span className="ce-ax-qn is-llm">{llmCalls}</span>
              <b>LLM calls</b>
              <span>Every prompt sent and reply received</span>
            </button>
            <button type="button" onClick={() => onQuick({ changedOnly: true })}>
              <span className="ce-ax-qn">{stateChanges}</span>
              <b>Intent &amp; state changes</b>
              <span>Where the conversation moved</span>
            </button>
            <button type="button" onClick={() => onQuick({})}>
              <span className="ce-ax-qn">{rows.length}</span>
              <b>All activity</b>
              <span>Every audit row, newest first</span>
            </button>
          </div>
        )}

        <div className="ce-ax-fgroup">
          <div className="ce-ax-section-h">
            <h4>Recent conversations</h4>
            {convs.length > recent.length && (
              <button type="button" className="ce-ax-chip" onClick={() => onQuick({})}>All {convs.length}</button>
            )}
          </div>
          {!recent.length ? (
            <div className="ce-ax-empty"><b>{loading ? 'Loading conversations…' : 'No conversations yet.'}</b>{!loading && 'Send a message in the chat, then come back here.'}</div>
          ) : (
            <div className="ce-ax-cards">
              {recent.map((c) => {
                const last = c.turns[c.turns.length - 1];
                const reply = turnOutText(last);
                const llm = c.rows.filter((r) => r.m.isLlm).length;
                const ms = c.turns.reduce((a, t) => a + t.ms, 0);
                // Stage families as a proportional strip — the shape of the
                // conversation at a glance, step hooks excluded.
                const fam = {};
                c.rows.forEach((r) => { if (r.m.family !== 'step') fam[r.m.family] = (fam[r.m.family] ?? 0) + 1; });
                const famTotal = Object.values(fam).reduce((a, b) => a + b, 0) || 1;
                return (
                  <button key={c.cid} type="button" className="ce-ax-card" onClick={() => onOpenConversation(c.cid)}>
                    <div className="ce-ax-card-top">
                      <span className={`ce-ax-status ${c.ok ? 'is-ok' : 'is-fail'}`}>{c.ok ? 'Answered' : 'Failed'}</span>
                      <span className="ce-ax-cid" title={c.cid}>{shortId(c.cid)}</span>
                      <span className="ce-ax-grow" />
                      <span className="ce-ax-meta">{timeAgo(c.latest)}</span>
                    </div>
                    <div className="ce-ax-card-q">{c.first || '—'}</div>
                    <div className={`ce-ax-card-a${last?.fail ? ' is-fail' : ''}`} title={reply}>{reply}</div>
                    <div className="ce-ax-spark" aria-hidden="true">
                      {Object.entries(fam).map(([f, n]) => (
                        <i key={f} style={{ width: `${(n / famTotal) * 100}%`, background: AUDIT_STAGE_FAMILIES[f]?.color }} />
                      ))}
                    </div>
                    <div className="ce-ax-card-foot">
                      <span>{c.turns.length} turn{c.turns.length > 1 ? 's' : ''}</span>
                      <span>{c.rows.length} rows</span>
                      <span>{llm} LLM</span>
                      <span>{fmtMs(ms)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── KPIs ────────────────────────────────────────────────────────────────── */
function Kpis({ visible, rows, convs }) {
  const convSet = new Set(visible.map((r) => r.cid));
  const turns = new Set(visible.map((r) => `${r.cid}:${r.turn}`)).size;
  const llm = visible.filter((r) => r.m.isLlm).length;
  const errs = visible.filter((r) => r.m.severity === 'error').length;
  const ms = convs.flatMap((c) => c.turns).filter((t) => convSet.has(t.rows[0]?.cid)).reduce((a, t) => a + t.ms, 0);
  const items = [
    ['Rows', <>{visible.length}<small>/{rows.length}</small></>],
    ['Conversations', convSet.size],
    ['Turns', turns],
    ['LLM calls', llm],
    ['Failures', errs, errs ? 'is-err' : ''],
    ['Pipeline', fmtMs(ms)],
  ];
  return (
    <div className="ce-ax-kpis">
      {items.map(([label, value, cls]) => (
        <div key={label} className={`ce-ax-kpi ${cls ?? ''}`}><b>{value}</b><span>{label}</span></div>
      ))}
    </div>
  );
}

/* ── The request the filters make ────────────────────────────────────────── */
function ApiReadout({ F, rows, serverParams, limit, staticRows }) {
  const qs = [];
  if (F.q) qs.push(['q', F.q]);
  for (const [k, v] of Object.entries(serverParams)) qs.push([k, String(v)]);
  if (F.families.length) {
    const stages = [...new Set(rows.filter((r) => F.families.includes(r.m.family)).map((r) => r.m.base))];
    if (stages.length) qs.push(['stage', stages.join(',')]);
  }
  qs.push(['limit', String(limit)]);
  const client = [];
  if (F.hideSteps) client.push('hide step hooks');
  if (F.llmOnly) client.push('LLM calls only');
  if (F.changedOnly) client.push('intent/state changed');
  if (F.inputParamsChanged) client.push('inputParams changed');
  if (F.minPayloadKb) client.push(`payload ≥ ${F.minPayloadKb}KB`);
  if (F.outcome !== 'all') client.push(F.outcome === 'ok' ? 'answered turns' : 'failed turns');
  if (F.conversations.length > 1) client.push(`${F.conversations.length} conversations`);
  if (F.families.length) client.push('stage families');
  return (
    <div className="ce-ax-api">
      <span>{staticRows ? 'As a request, these filters would be:' : 'These filters as a request:'}</span>
      <code>
        <span className="ce-ax-m">GET</span> /api/v1/conversation/audit/search<span className="ce-ax-p">?</span>
        {qs.map(([k, v], i) => (
          <span key={k}>{i > 0 && <span className="ce-ax-p">&amp;</span>}{k}={encodeURIComponent(v).replace(/%2C/g, ',')}</span>
        ))}
      </code>
      {client.length > 0 && <span className="ce-ax-client">· in the browser: <em>{client.join(', ')}</em></span>}
    </div>
  );
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
function FiltersBody({ F, setFilters, rows, convs, convOk }) {
  const counts = (skip, key) => {
    const m = {};
    rows.forEach((r) => { if (rowPasses(r, F, convOk, skip)) { const k = key(r); m[k] = (m[k] ?? 0) + 1; } });
    return m;
  };
  const famCounts = counts('families', (r) => r.m.family);
  const intCounts = counts('intents', (r) => r.intent ?? '—');
  const stCounts = counts('states', (r) => r.state ?? '—');
  const convCounts = counts('conversations', (r) => r.cid);
  const intents = [...new Set(rows.map((r) => r.intent ?? '—'))];
  const states = [...new Set(rows.map((r) => r.state ?? '—'))];
  const families = Object.keys(AUDIT_STAGE_FAMILIES).filter((f) => rows.some((r) => r.m.family === f));
  const toggleIn = (key, v) => setFilters((p) => ({ [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }));

  const chipSet = (key, values, cnt, render) => values.map((v) => {
    const on = F[key].includes(v);
    const n = cnt[v] ?? 0;
    return (
      <button key={v} type="button" className={`ce-ax-chip${key !== 'families' ? ' is-mono' : ''}`} aria-pressed={on} disabled={!n && !on} onClick={() => toggleIn(key, v)}>
        {render ? render(v) : v}<span className="ce-ax-c">{n}</span>
      </button>
    );
  });
  const clear = (key) => F[key].length > 0 && <button type="button" onClick={() => setFilters({ [key]: [] })}>clear</button>;
  const Toggle = ({ k, label, hint }) => (
    <label className="ce-ax-toggle" htmlFor={`ce-ax-t-${k}`}>
      <span>{label}{hint && <small>{hint}</small>}</span>
      <input id={`ce-ax-t-${k}`} type="checkbox" checked={!!F[k]} onChange={(e) => setFilters({ [k]: e.target.checked })} />
    </label>
  );

  return (
    <>
      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">Outcome</div>
        <div className="ce-ax-seg">
          {[['all', 'All'], ['ok', 'Answered'], ['fail', 'Failed']].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={F.outcome === v} onClick={() => setFilters({ outcome: v })}>{l}</button>
          ))}
        </div>
      </div>

      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">Conversations {clear('conversations')}</div>
        <div className="ce-ax-convs">
          {convs.map((c) => (
            <button key={c.cid} type="button" className="ce-ax-conv-opt" aria-pressed={F.conversations.includes(c.cid)} onClick={() => toggleIn('conversations', c.cid)}>
              <span className="ce-ax-dot" style={{ background: c.ok ? 'var(--ce-ax-ok)' : 'var(--ce-ax-err)' }} />
              <span className="ce-ax-cid">{shortId(c.cid)}</span>
              <span className="ce-ax-n">{c.turns.length}t · {convCounts[c.cid] ?? 0}</span>
              <span className="ce-ax-q">{c.first}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">Stage family {clear('families')}</div>
        <div className="ce-ax-chips">
          {chipSet('families', families, famCounts, (f) => (
            <><span className="ce-ax-d" style={{ background: AUDIT_STAGE_FAMILIES[f].color }} />{AUDIT_STAGE_FAMILIES[f].label}</>
          ))}
        </div>
      </div>

      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">Intent at the time {clear('intents')}</div>
        <div className="ce-ax-chips">{chipSet('intents', intents, intCounts)}</div>
      </div>

      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">State at the time {clear('states')}</div>
        <div className="ce-ax-chips">{chipSet('states', states, stCounts)}</div>
      </div>

      <div className="ce-ax-fgroup">
        <div className="ce-ax-lbl">Show</div>
        <Toggle k="hideSteps" label="Hide step hooks" hint="STEP_ENTER / STEP_EXIT" />
        <Toggle k="errorsOnly" label="Failures only" />
        <Toggle k="llmOnly" label="LLM calls only" hint="prompts and replies" />
        <Toggle k="changedOnly" label="Intent or state changed" />
        <Toggle k="inputParamsChanged" label="inputParams changed" />
      </div>

      <div className="ce-ax-fgroup">
        <label className="ce-ax-lbl" htmlFor="ce-ax-minkb">Payload size</label>
        <div className="ce-ax-range">
          <input id="ce-ax-minkb" type="range" min="0" max="40" step="1" value={F.minPayloadKb} onChange={(e) => setFilters({ minPayloadKb: Number(e.target.value) })} />
          <output>≥ {F.minPayloadKb}KB</output>
        </div>
      </div>
    </>
  );
}

/* ── Waterfall of the selected turn ──────────────────────────────────────── */
function Waterfall({ convs, selected, onJump }) {
  const turn = convs.find((c) => c.cid === selected?.cid)?.turns.find((t) => t.n === selected.turn);
  if (!turn || !turn.steps.length) {
    return <div className="ce-ax-waterfall"><p className="ce-ax-note">Select a row to see its turn’s pipeline.</p></div>;
  }
  const total = turn.steps.reduce((a, s) => a + s.ms, 0) || 1;
  const slowest = turn.steps.reduce((a, s) => (s.ms > a.ms ? s : a));
  let acc = 0;
  return (
    <div className="ce-ax-waterfall">
      <div className="ce-ax-wf-head">
        <b>Turn {turn.n} pipeline</b>
        <span>{turn.steps.length} steps · {fmtMs(turn.ms)} · slowest {slowest.name} {slowest.ms}ms</span>
      </div>
      <div className="ce-ax-wf">
        {turn.steps.map((s, i) => {
          // Bars sit at their cumulative offset, scaled to the whole turn, so
          // the chart reads as a waterfall and the slow step is obvious.
          const left = (acc / total) * 100;
          const width = Math.max((s.ms / total) * 100, 0.6);
          acc += s.ms;
          const target = s.enter ?? s.exit;
          const on = selected.step === s.name;
          return (
            <div key={`${s.name}-${i}`} className={`ce-ax-wf-row${on ? ' is-on' : ''}`} title={`${s.name} — ${s.ms}ms`} onClick={() => onJump(target)}>
              <button type="button" className="ce-ax-wf-step" onClick={(e) => { e.stopPropagation(); onJump(target); }}>{s.name.replace(/Step$/, '')}</button>
              <div className="ce-ax-wf-track"><div className={`ce-ax-wf-bar${s.err ? ' is-err' : s.llm ? ' is-llm' : ''}`} style={{ left: `${left}%`, width: `${width}%` }} /></div>
              <span className="ce-ax-wf-ms">{s.ms}ms</span>
            </div>
          );
        })}
      </div>
      <div className="ce-ax-wf-legend">
        <span><i className="is-step" />step</span>
        <span><i className="is-llm" />calls the LLM</span>
        <span><i className="is-err" />failed</span>
      </div>
    </div>
  );
}

/* ── Timeline ────────────────────────────────────────────────────────────── */
function turnOutText(t) {
  if (t.out) {
    const v = tryParseJson(t.out);
    if (typeof v === 'string') return v;
    return String(v?.answer ?? JSON.stringify(v));
  }
  if (t.fail) return `${t.fail.m.label}${t.fail.body?.message ? ` — ${t.fail.body.message}` : ''}`;
  return '—';
}

function Timeline({ convs, visibleSet, selected, onSelect, loading }) {
  const any = convs.some((c) => c.rows.some((r) => visibleSet.has(r)));
  if (!any) {
    return (
      <div className="ce-ax-empty">
        <b>{loading ? 'Loading audit rows…' : 'Nothing matches these filters.'}</b>
        {!loading && 'Clear a filter on the left, or turn off “Hide step hooks” if you searched for a step name.'}
      </div>
    );
  }
  return convs.map((c) => {
    const crows = c.rows.filter((r) => visibleSet.has(r));
    if (!crows.length) return null;
    return (
      <section key={c.cid} className="ce-ax-conv">
        <div className="ce-ax-conv-h">
          <span className={`ce-ax-status ${c.ok ? 'is-ok' : 'is-fail'}`}>{c.ok ? 'Answered' : 'Failed'}</span>
          <span className="ce-ax-cid" title={c.cid}>{c.cid}</span>
          <span className="ce-ax-meta">{c.turns.length} turn{c.turns.length > 1 ? 's' : ''} · {crows.length}/{c.rows.length} rows{c.fail ? ` · ${c.fail.m.label}` : ''}</span>
        </div>
        {c.turns.map((t) => {
          const trows = t.rows.filter((r) => visibleSet.has(r));
          if (!trows.length) return null;
          const out = turnOutText(t);
          return (
            <div key={t.n}>
              <div className="ce-ax-turn-h">
                <span className="ce-ax-t">Turn {t.n}</span>
                <div className="ce-ax-io">
                  <div className="ce-ax-in" title={t.user}>{t.user}</div>
                  <div className={`ce-ax-out${t.fail ? ' is-fail' : ''}`} title={out}>{out}</div>
                </div>
                <span className="ce-ax-ms">{fmtMs(t.ms)}</span>
              </div>
              <ul className="ce-ax-rows" role="listbox" aria-label={`Turn ${t.n} audit rows`}>
                {trows.map((r) => (
                  <li key={r.id} className="ce-ax-row" role="option" data-ax-row={r.id} aria-selected={selected?.id === r.id} onClick={() => onSelect(r)}>
                    <span className="ce-ax-stripe" style={{ background: r.m.color }} />
                    <span className="ce-ax-ts">+{r.off}ms</span>
                    <div className="ce-ax-main">
                      <div className="ce-ax-l1">
                        <span className="ce-ax-label">{r.m.label}</span>
                        {r.m.sub && <span className="ce-ax-sub" title={r.m.sub}>{r.m.sub}</span>}
                        {r.m.severity === 'error' && <span className="ce-ax-sev is-error">failed</span>}
                        {r.m.severity === 'warn' && <span className="ce-ax-sev is-warn">warn</span>}
                        {!r.m.severity && r.m.isLlm && <span className="ce-ax-sev is-llm">LLM</span>}
                      </div>
                      <div className="ce-ax-l2">
                        <span className="ce-ax-const">{r.stage}</span>
                        {r.step && <span className="ce-ax-step">· {r.step}</span>}
                      </div>
                    </div>
                    <div className="ce-ax-right">
                      <KV k="intent" v={r.intent} changed={r.intentChanged} />
                      <KV k="state" v={r.state} changed={r.stateChanged} />
                      <span className="ce-ax-sz">{fmtBytes(r.bytes)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    );
  });
}

/* ── Inspector ───────────────────────────────────────────────────────────── */
function Inspector({ row, rows, convs, tab, tabs, onTab, onJump }) {
  if (!row) {
    return <div className="ce-ax-empty"><b>Pick a row</b>Its inputs, outputs and metadata show here.</div>;
  }
  const bodyKeys = Object.keys(row.body ?? {}).length;
  return (
    <>
      <div className="ce-ax-insp-title">
        <div className="ce-ax-l1"><span className="ce-ax-dot is-lg" style={{ background: row.m.color }} /><h3>{row.m.label}</h3></div>
        <span className="ce-ax-const">{row.stage} · #{row.id}{row.at ? ` · ${String(row.at).replace('T', ' ').replace('Z', '')}` : ''}</span>
        <div className="ce-ax-facts">
          <KV k="family" v={row.m.familyLabel} />
          <KV k="intent" v={row.intent} changed={row.intentChanged} />
          <KV k="state" v={row.state} changed={row.stateChanged} />
          {row.step && <KV k="step" v={row.step} />}
          <KV k="size" v={fmtBytes(row.bytes)} />
        </div>
      </div>
      <div className="ce-ax-tabs" role="tablist">
        {tabs.filter((t) => TABS[t]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
            {TABS[t]}{t === 'body' && <span className="ce-ax-n">{bodyKeys}</span>}
          </button>
        ))}
      </div>
      <div className="ce-ax-scroll ce-ax-insp-body" key={`${row.id}-${tab}`}>
        {tab === 'io' && <TabIO row={row} rows={rows} convs={convs} onJump={onJump} />}
        {tab === 'body' && <TabBody row={row} />}
        {tab === 'meta' && <TabMeta row={row} />}
        {tab === 'raw' && <TabRaw row={row} />}
      </div>
    </>
  );
}

function TabIO({ row, rows, convs, onJump }) {
  const turn = convs.find((c) => c.cid === row.cid)?.turns.find((t) => t.n === row.turn);
  const pair = row.m.isLlm ? llmPairOf(row, rows) : null;
  const srows = stepRowsOf(row, rows);

  return (
    <>
      {pair && (
        <div className="ce-ax-io-grid">
          <IoCard dir="in" title="Sent to the model" current={pair.input === row} other={pair.input !== row && pair.input} onJump={onJump}>
            {pair.input ? (
              <>
                {Object.entries(pair.input.body).filter(([k]) => !/^templateFromCeConfig/.test(k)).map(([k, v]) => <Field key={k} name={k} value={v} />)}
                {Object.entries(pair.input.body).filter(([k]) => /^templateFromCeConfig/.test(k)).map(([k, v]) => (
                  <p key={k} className="ce-ax-note">Prompts from <code>{k.replace('templateFromCeConfig ', 'ce_config ')}</code>: <code>{String(v)}</code></p>
                ))}
              </>
            ) : <p className="ce-ax-note">No matching prompt row in this turn.</p>}
          </IoCard>
          <IoCard dir="out" title="Returned by the model" current={pair.output === row} other={pair.output !== row && pair.output} onJump={onJump}>
            {pair.output
              ? Object.entries(pair.output.body).map(([k, v]) => <Field key={k} name={k} value={v} />)
              : <p className="ce-ax-note">No reply row — the call did not return.</p>}
          </IoCard>
        </div>
      )}

      {srows.length > 0 && <StepInOut row={row} srows={srows} onJump={onJump} />}

      {turn && (
        <div className="ce-ax-fgroup">
          <h4>Turn {turn.n} <small>{fmtMs(turn.ms)}</small></h4>
          <div className="ce-ax-io-grid">
            <IoCard dir="in" title="User said"><p className="ce-ax-prose">{turn.user || '—'}</p></IoCard>
            <IoCard dir="out" title={turn.fail ? 'Turn failed' : 'Assistant replied'}>
              {turn.fail ? (
                <>
                  <p className="ce-ax-prose is-err">{turn.fail.m.label}</p>
                  <Field name={turn.fail.stage} value={turn.fail.body} />
                </>
              ) : (() => {
                const v = turn.out ? tryParseJson(turn.out) : null;
                return typeof v === 'string' ? <p className="ce-ax-prose">{v}</p> : v ? <Code value={v} /> : <p className="ce-ax-note">No reply recorded.</p>;
              })()}
            </IoCard>
          </div>
        </div>
      )}
    </>
  );
}

function IoCard({ dir, title, current, other, onJump, children }) {
  return (
    <article className={`ce-ax-io-card${current ? ' is-cur' : ''}`}>
      <header>
        <span className={`ce-ax-dir is-${dir}`}>{dir === 'in' ? 'IN' : 'OUT'}</span>
        {title}
        <span className="ce-ax-grow" />
        {other && <button type="button" onClick={() => onJump(other)}>open row</button>}
      </header>
      <div className="ce-ax-io-body">{children}</div>
    </article>
  );
}

function StepInOut({ row, srows, onJump }) {
  const enter = srows.find((x) => x.m.base === 'STEP_ENTER') ?? srows[0];
  const exit = srows.find((x) => x.m.base === 'STEP_EXIT' || x.m.base === 'STEP_ERROR') ?? srows[srows.length - 1];
  const ipAdded = {};
  srows.forEach((x) => Object.assign(ipAdded, x.ipSet));
  const inner = srows.filter((x) => x.m.family !== 'step');
  const Side = ({ label, r, other }) => (
    <div className="ce-ax-side">
      <span>{label}</span>
      <div className={`ce-ax-v${other && other.intent !== r.intent ? ' is-changed' : ''}`}>intent {r.intent ?? '—'}</div>
      <div className={`ce-ax-v${other && other.state !== r.state ? ' is-changed' : ''}`}>state {r.state ?? '—'}</div>
    </div>
  );
  return (
    <div className="ce-ax-fgroup">
      <h4>
        {row.step}{' '}
        <small>
          {exit.body?.durationMs != null ? `${exit.body.durationMs}ms` : ''}
          {exit.m.base === 'STEP_ERROR' ? ' · failed' : exit.body?.outcome ? ` · ${exit.body.outcome}` : ''}
        </small>
      </h4>
      <div className="ce-ax-delta">
        <Side label="ENTERING" r={enter} />
        <span className="ce-ax-arrow">→</span>
        <Side label="LEAVING" r={exit} other={enter} />
      </div>
      <div className="ce-ax-stage-list">
        {inner.length
          ? inner.map((x) => (
            <button key={x.id} type="button" className={x === row ? 'is-cur' : ''} onClick={() => onJump(x)}>
              <span className="ce-ax-d" style={{ background: x.m.color }} />{x.m.label}
              {x.m.sub && <span className="ce-ax-sub-inline">{x.m.sub}</span>}
            </button>
          ))
          : <p className="ce-ax-note">This step wrote no stages of its own — it only bracketed the pipeline.</p>}
      </div>
      {Object.keys(ipAdded).length > 0 && <Field name="inputParams set during this step" value={stripSession(ipAdded)} />}
    </div>
  );
}

function TabBody({ row }) {
  const entries = Object.entries(row.body ?? {});
  if (!entries.length) return <p className="ce-ax-note">This stage wrote no body of its own — everything it recorded is in Metadata.</p>;
  const scalar = ([, v]) => v == null || (typeof v !== 'object' && String(v).length <= 60);
  return (
    <>
      <dl className="ce-ax-facts-grid">
        {entries.filter(scalar).map(([k, v]) => (
          <FactRow key={k} k={k} v={v} />
        ))}
      </dl>
      {entries.filter((e) => !scalar(e)).map(([k, v]) => <Field key={k} name={k} value={v} />)}
    </>
  );
}

function FactRow({ k, v, style }) {
  const cls = v === true ? 'is-true' : v === false || v == null ? 'is-false' : '';
  return (
    <>
      <dt>{k}</dt>
      <dd className={cls} style={style}>{v == null ? 'null' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
    </>
  );
}

function TabMeta({ row }) {
  const m = row.meta;
  if (!m) return <p className="ce-ax-note">This row carries no _meta envelope — the backend did not record one.</p>;
  const s = m.session ?? {};
  const si = row.stepInfo;
  const flags = ['intentLocked', 'intentLockReason', 'schemaComplete', 'hasAnySchemaValue', 'postIntentRule', 'lastLlmStage', 'hasContainerData', 'standaloneQuery', 'pendingClarificationQuestion'];
  const hasObj = (v) => v && typeof v === 'object' && Object.keys(v).length > 0;
  return (
    <>
      <dl className="ce-ax-facts-grid">
        <FactRow k="emittedAt" v={m.emittedAt} />
        <FactRow k="intent" v={m.intent} />
        <FactRow k="state" v={m.state} />
        <FactRow k="conversationId" v={m.conversationId} />
        <FactRow k="steps run so far" v={row.stepsSoFar} />
      </dl>

      {si && (
        <div className="ce-ax-fgroup">
          <h4>This step <small>{si.stepName}</small></h4>
          <dl className="ce-ax-facts-grid">
            <FactRow k="status" v={si.status} />
            <FactRow k="determinant" v={si.determinant} />
            <FactRow k="outcome" v={si.outcome} />
            <FactRow k="durationMs" v={si.durationMs} />
            <FactRow k="stepClass" v={si.stepClass} />
            {si.errorType && <FactRow k="errorType" v={si.errorType} style={{ color: 'var(--ce-ax-err)' }} />}
            {si.errorMessage && <FactRow k="errorMessage" v={si.errorMessage} style={{ color: 'var(--ce-ax-err)' }} />}
          </dl>
        </div>
      )}

      <div className="ce-ax-fgroup">
        <h4>Session at this moment</h4>
        <dl className="ce-ax-facts-grid">
          {flags.filter((k) => k in s).map((k) => <FactRow key={k} k={k} v={s[k]} />)}
          {Array.isArray(s.missingRequiredFields) && <FactRow k="missingRequiredFields" v={s.missingRequiredFields.join(', ') || '[]'} />}
        </dl>
        {hasObj(s.context) && <Field name="session.context" value={s.context} />}
        {hasObj(s.schemaJson) && <Field name="session.schemaJson" value={s.schemaJson} />}
        {hasObj(s.lastLlmOutput) && <Field name="session.lastLlmOutput" value={s.lastLlmOutput} />}
      </div>

      <div className="ce-ax-fgroup">
        <h4>inputParams <small>{row.inputParams ? Object.keys(row.inputParams).length : 0} keys</small></h4>
        {row.ipChanged ? (
          <>
            <Field name="changed by this row" value={stripSession(row.ipSet)} />
            {row.ipRemoved.length > 0 && <p className="ce-ax-note">removed: <code>{row.ipRemoved.join(', ')}</code></p>}
          </>
        ) : <p className="ce-ax-note">Unchanged from the previous row.</p>}
        {row.inputParams && (
          <details>
            <summary className="ce-ax-note">Full inputParams at this row</summary>
            <Code value={stripSession(row.inputParams)} tall />
          </details>
        )}
      </div>
    </>
  );
}

function TabRaw({ row }) {
  return (
    <>
      <p className="ce-ax-note">The row as <code>GET /audit/{'{conversationId}'}</code> returns it, with <code>payloadJson</code> parsed.</p>
      <Code
        tall
        value={{
          auditId: row.id,
          conversationId: row.cid,
          stage: row.stage,
          createdAt: row.at,
          payloadJson: { ...row.body, ...(row.meta ? { _meta: row.meta } : {}) },
        }}
      />
    </>
  );
}

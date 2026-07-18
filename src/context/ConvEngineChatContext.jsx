import { createContext, useContext, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createApiClient } from '../api/client.js';
import { createStreamClient } from '../api/stream.js';
import { createClientId } from '../utils/uuid.js';

/* ── Context ──────────────────────────────────────────────────────────────── */

const ConvEngineChatContext = createContext(null);

/* ── Provider ─────────────────────────────────────────────────────────────── */

/**
 * Provides the resolved config and API client to every child component.
 * Consumers should not use this directly — it is set up by <ConvEngineChat>.
 *
 * @param {{ config: import('../index.js').ConvEngineChatConfig, children: React.ReactNode }} props
 */
export function ConvEngineChatProvider({ config = {}, children }) {
  // Stable conversation ID: use caller-provided one or auto-generate once.
  const conversationId = useMemo(
    () => config.conversationId || createClientId(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.conversationId],
  );

  const apiClient = useMemo(
    () => createApiClient(config.apiHost ?? '', config.apiEndpoints ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.apiHost, JSON.stringify(config.apiEndpoints)],
  );

  const streamEnabled = !!(config.stream?.enabled);
  const streamClient = useMemo(
    () => streamEnabled
      ? createStreamClient(config.apiHost ?? '', config.stream ?? {})
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [streamEnabled, config.apiHost, JSON.stringify(config.stream)],
  );

  const resolvedConfig = useMemo(
    () => ({
      // ── API ─────────────────────────────────��─────────────────────────────
      // apiEndpoints lets consumers override individual endpoint paths/URLs.
      // Each key overrides one route; omitted keys fall back to the default
      // {apiHost}/api/v1/conversation/{message|feedback|audit} paths.
      // Example: { message: '/api/v1/message', feedback: '/api/v1/feedback' }
      apiEndpoints: config.apiEndpoints ?? null,
      // ── Text content — all consumer-overrideable ────────────────────────
      title:             config.title            ?? 'ConvEngine Assistant',
      subtitle:          config.subtitle         ?? "Ask me anything \u2014 I\u2019ll do my best to help.",
      placeholder:       config.placeholder      ?? 'Ask ConvEngine\u2026',
      // ── Visibility toggles ─────────────────────────────────────────────
      showAudit:             config.showAudit             ?? false,
      showFeedback:          config.showFeedback          ?? true,
      showDarkModeLightMode: config.showDarkModeLightMode ?? false,
      defaultDark:           config.defaultDark           ?? false,
      showHeaderDot:         config.showHeaderDot         ?? true,
      showLandingAvatar:     config.showLandingAvatar     ?? true,
      showLandingSubtitle:   config.showLandingSubtitle   ?? true,
      showNewChat:           config.showNewChat           ?? true,
      showLayoutPicker:      config.showLayoutPicker      ?? true,
      showMaximize:          config.showMaximize          ?? true,
      showMinimize:          config.showMinimize          ?? true,
      showEngineStatus:      config.showEngineStatus      ?? true,
      // Reply-to-message affordance on assistant bubbles (Reply-style). The
      // reply icon appears on hover; clicking it quotes that bubble in the
      // composer and sends its text as inputParams.replySourceText.
      showBubbleReply:       config.showBubbleReply       ?? true,
      // ── Renderers & callbacks ──────────────────────────────────────────
      rendererProviders: Array.isArray(config.renderers) ? config.renderers : [],
      onMessage:  config.onMessage  ?? null,
      onResponse: config.onResponse ?? null,
      onSubmit:   config.onSubmit   ?? null,
      onFeedback: config.onFeedback ?? null,
      // ── Consumer icon overrides ────────────────────────────────────────
      icons: config.icons ?? {},
      // ── Color overrides (shorthand; applied as CSS vars on root) ──────
      bubbleUserBg:    config.bubbleUserBg    ?? null,
      bubbleUserText:  config.bubbleUserText  ?? null,
      bubbleAgentBg:   config.bubbleAgentBg   ?? null,
      bubbleAgentText: config.bubbleAgentText ?? null,
      panelBg:         config.panelBg         ?? null,
      composerBg:      config.composerBg      ?? null,
      iconColor:       config.iconColor       ?? null,
      composerShape:   config.composerShape   ?? 'round',
      // ── Message enrichment ─────────────────────────────────────────────
      // messageEnrichment: {
      //   prefix:      string,     // optional — wraps outgoing text: "{prefix} {text} {suffix}"
      //   suffix:      string,     // optional
      //   inputParams: object,     // optional — merged into every request's inputParams
      //   preHook:     function[], // optional — run sequentially before send, may transform payload
      //   postHook:    function[], // optional — run sequentially after the response arrives
      // }
      messageEnrichment: config.messageEnrichment ?? null,
      // ── Streaming ────────────────────────────────────────────
      // config.stream: { enabled?: boolean, transport?: 'sse'|'stomp', wsBase?: string }
      // When enabled, the widget subscribes to the SSE/STOMP stream after each send,
      // reflecting STEP_ENTER progress and live ASSISTANT_OUTPUT in the bubble.
      stream: {
        enabled:   streamEnabled,
        transport: config.stream?.transport ?? 'sse',
        wsBase:    config.stream?.wsBase    ?? null,
      },      // ── Transport badge ───────────────────────────────────
      // When true, a small REST / SSE / STOMP badge appears in the chat header.
      // Useful for demos and debugging — default false.
      showTransportBadge: config.showTransportBadge ?? false,
      // ── Debug flags ───────────────────────────────────────
      // All debug flags default false — zero cost in production.
      // debugShowVerbose        : always show “Agent is thinking…” without sending a message.
      // debugShowPayload         : raw payload pre-block under every assistant bubble.
      // debugShowRenderer        : chip showing which renderer key matched (e.g. "default", "faq-answer").
      // debugShowTimestamps      : HH:mm:ss timestamp chip on every bubble.
      // debugShowMessageId       : truncated bubble id chip on every bubble.
      // debugSimulateDelay (ms)  : artificial delay before every API response (0 = off).
      // debugSimulateError       : every send throws a simulated error bubble — no real API call made.
      // debugHighlightRenderers  : dashed outline around every bubble; amber=user, blue=agent.
      // debugDisableAnimations   : kills all CSS transitions & animations on the widget.
      debugShowVerbose:          config.debugShowVerbose          ?? false,
      debugShowPayload:          config.debugShowPayload          ?? false,
      debugShowRenderer:         config.debugShowRenderer         ?? false,
      debugShowTimestamps:       config.debugShowTimestamps       ?? false,
      debugShowMessageId:        config.debugShowMessageId        ?? false,
      debugSimulateDelay:        config.debugSimulateDelay        ?? 0,
      debugSimulateError:        config.debugSimulateError        ?? false,
      debugHighlightRenderers:   config.debugHighlightRenderers   ?? false,
      debugDisableAnimations:    config.debugDisableAnimations    ?? false,

      // ── Bubble time caption & date separator chips ────────────────────
      // showBubbleTime    : renders an "h:mm A" caption below every bubble.
      // bubbleTimeFormat  : token string passed to formatTime() — e.g. 'h:mm A', 'HH:mm', 'h:mm:ss A'.
      // showDateSeparators: sticky date chip between day groups.
      // dateSeparatorFormat: 'auto' (“Today / Yesterday / ddd, MMM D”) or any date token string.
      showBubbleTime:      config.showBubbleTime      ?? false,
      bubbleTimeFormat:    config.bubbleTimeFormat     ?? 'h:mm A',
      showDateSeparators:  config.showDateSeparators   ?? false,
      dateSeparatorFormat: config.dateSeparatorFormat  ?? 'auto',
      dateSeparatorShape:  config.dateSeparatorShape   ?? 'round',
      // ── Landing chips ──────────────────────────────────────────────────
      // landingChips: string[] | { chipText: string, chatText: string }[]
      //   Suggestion chips shown below the landing avatar.
      //   string[]  → chip label = sent message
      //   object[]  → chipText shown, chatText sent
      // landingChipsOrientation:   'row' | 'column'            (default 'row')
      // landingChipsShape:         'round' | 'rect'            (default 'round')
      // landingChipsAnchor:        'landingAgent' | 'chatbox'  (default 'landingAgent')
      //   'landingAgent' → chips below the avatar/hero (classic)
      //   'chatbox'      → chips pinned above the composer (ChatGPT style),
      //                    column chips grow bottom → top
      // landingChipsAnchorPadding: number | string  — gap in px between anchor
      //                            and chips (default 8px via CSS var)
      landingChips:               config.landingChips               ?? null,
      landingChipsOrientation:    config.landingChipsOrientation    ?? 'row',
      landingChipsShape:          config.landingChipsShape          ?? 'round',
      landingChipsAnchor:         config.landingChipsAnchor         ?? 'landingAgent',
      landingChipsAnchorPadding:  config.landingChipsAnchorPadding  ?? undefined,
    }),
    // Config values compared shallowly; stringify avoids over-rerendering on
    // inline object literals while still reacting to genuine changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(config)],
  );

  const ctx = useMemo(
    () => ({ conversationId, apiClient, streamClient, config: resolvedConfig }),
    [conversationId, apiClient, streamClient, resolvedConfig],
  );

  // ── Shared chat state — lives here so it survives mode switches ──────────
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [isTyping,      setIsTyping]      = useState(false);
  const [progressText,  setProgressText]  = useState('');
  const [auditRevision, setAuditRevision] = useState(0);
  const threadRef = useRef(null);
  const inputRef  = useRef(null);

  // ── Reply / context pill — a first-class "reply-to" preview pinned in the
  // composer. Two ways to drive it, both landing in the same state:
  //   • declaratively via config.replyContext (reactive — best for consumers
  //     that already track a "current context" in their own store), or
  //   • imperatively via actions.setReplyContext()/clearReplyContext().
  // Shape: { label?, text, accent?, meta?, onClick?, onClear?, clearable? }.
  //   meta   → folded into inputParams on the next send (grounds the question).
  //   onClick→ makes the pill a link (e.g. jump to the referenced thing).
  const [replyContext, setReplyContext] = useState(config.replyContext ?? null);
  const clearReplyContext = useCallback(() => setReplyContext(null), []);
  // Sync from config.replyContext without depending on function identity: key
  // on the serialisable parts so an inline object literal each render is fine.
  const replyCfgRef = useRef(config.replyContext);
  replyCfgRef.current = config.replyContext ?? null;
  const replyKey = config.replyContext
    ? `${config.replyContext.label ?? ''}|${config.replyContext.text ?? ''}|${JSON.stringify(config.replyContext.meta ?? null)}`
    : '';
  useEffect(() => {
    setReplyContext(replyCfgRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyKey]);

  const chatState = useMemo(() => ({
    messages,      setMessages,
    input,         setInput,
    isTyping,      setIsTyping,
    progressText,  setProgressText,
    auditRevision, setAuditRevision,
    replyContext,  setReplyContext, clearReplyContext,
    threadRef,
    inputRef,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [messages, input, isTyping, progressText, auditRevision, replyContext]);

  return (
    <ConvEngineChatContext.Provider value={{ ...ctx, chatState }}>
      {children}
    </ConvEngineChatContext.Provider>
  );
}

/* ── Consumer hook ────────────────────────────────────────────────────────── */

export function useConvEngineChatContext() {
  const ctx = useContext(ConvEngineChatContext);
  if (!ctx) {
    throw new Error(
      '[convengine-chat] useConvEngineChatContext must be called inside <ConvEngineChat>.',
    );
  }
  return ctx;
}

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
/** Config keys the library reads under a different name than it stores.
 *  Add here when you rename an input — see the unknown-key warning below. */
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

  // Normalising the consumer's config = defaults + coercions. The literal
  // below lists a key ONLY because it needs a default; it is not, and must
  // not be, the set of keys the library supports.
  //
  // It used to be both, and that made it an allowlist: anything not listed
  // was dropped on the way in. A config option therefore took TWO edits in
  // two files — implement it where it's read, register it here — and doing
  // only the first made the option vanish silently. No error, no warning,
  // nothing visible in a devtools diff, because the object the components
  // saw was never the one the consumer passed. The feature just never fired.
  //
  // That has now cost three separate integrations (`attachments`,
  // `agentName`, `onNewChat`), each found the same way: someone driving the
  // real UI wondering why nothing happened. So `...config` goes first —
  // every key the consumer passed survives, and the entries below override
  // only what they actually normalise. A new option works the moment it is
  // read somewhere, with no second edit that can be forgotten.
  //
  // A dev warning for keys nothing recognises was built and then removed. It
  // needs a set of every supported key, and there is no runtime source for
  // one: 20+ legitimate options (apiHost, conversationId, replyContext,
  // initialMessages and the whole theme-colour surface) are read in other
  // files, so the check fired on all of them. Hand-maintaining that list is
  // the same two-place edit this change exists to delete, and a warning that
  // cries wolf on valid config teaches people to ignore warnings — worse
  // than the silence it replaced. A typo'd key still does nothing; it just
  // no longer takes a working feature down with it.
  const resolvedConfig = useMemo(
    () => {
      const normalized = {
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
      // The built-in FAB launcher (panel mode). Set false when you drive `open`
      // from your own trigger and don't want the library's floating button.
      showFab:               config.showFab               ?? true,
      // ── Draggable orb (panel mode) ───────────────────────────────────────
      // When the `draggable` prop is set on <ConvEngineChat>, the FAB becomes
      // a free-floating orb the user can drag anywhere on the page.
      // orbMovement: 'edgeSnap' (default) — release snaps to the nearest
      //   left/right edge, iOS AssistiveTouch style.
      // 'freeform' — the orb stays exactly wherever it's released; it can
      //   rest anywhere on the page, not just the edges.
      orbMovement:           config.orbMovement           ?? 'edgeSnap',
      // orbAnimation — named drag/snap animation style. 'bubblegum' (default)
      // is the springy squash-and-stretch original; 'none' disables all
      // animation for an instant, non-animated reposition. See
      // src/utils/orbAnimations.js for the full catalog (10 named styles).
      orbAnimation:          config.orbAnimation          ?? 'bubblegum',
      // Remembers the orb's last dropped position across reloads via
      // localStorage. Set false to always start from the default corner.
      persistOrbPosition:    config.persistOrbPosition    ?? true,
      orbStorageKey:         config.orbStorageKey         ?? 'ce-chat-orb-pos',
      showEngineStatus:      config.showEngineStatus      ?? true,
      // Reply-to-message affordance on assistant bubbles (Reply-style). The
      // reply icon appears on hover; clicking it quotes that bubble in the
      // composer and sends its text as inputParams.replySourceText.
      showBubbleReply:       config.showBubbleReply       ?? true,
      // "Open fullscreen in a new tab" — a URL to open, or a callback the
      // consumer handles. When set, the layout picker (panel/sidepanel) gains a
      // "Fullscreen (new tab)" option and fullscreen mode gains a header button.
      fullscreenTabUrl:      config.fullscreenTabUrl      ?? null,
      onOpenFullscreenTab:   config.onOpenFullscreenTab   ?? null,
      // ── Renderers & callbacks ──────────────────────────────────────────
      rendererProviders: Array.isArray(config.renderers) ? config.renderers : [],
      onMessage:  config.onMessage  ?? null,
      onResponse: config.onResponse ?? null,
      onSubmit:   config.onSubmit   ?? null,
      onFeedback: config.onFeedback ?? null,
      // Fired when the conversation is reset — the New Chat button (after its
      // confirmation) and actions.reset(). The library tells the BACKEND
      // itself (the next request carries reset:true); this is for state only
      // the consumer knows about.
      onNewChat:  config.onNewChat  ?? null,
      // The New Chat confirmation dialog: when to ask, and what it says.
      newChatConfirm: config.newChatConfirm ?? null,
      // Thumbs behaviour: whether to collect a written correction, what the
      // box says, and (feedback.submit) who owns the request.
      feedback: config.feedback ?? null,
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

      // Attachments + the agent label beside send.
      //
      // This provider resolves config into an explicit ALLOWLIST rather than
      // spreading the caller's object, so any key not listed here is silently
      // dropped: the consumer sets it, nothing errors, and the feature simply
      // never turns on. Confirmed live — config.attachments.enabled was true
      // at <ConvEngineChat> and false by the time useChat read it, with every
      // component in between wired correctly. Adding a config key means adding
      // it here too.
      attachments:     config.attachments     ?? null,
      agentName:       config.agentName       ?? '',

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

      // ── Message queue (Claude Code / Codex style) ───────────────────────
      // Sending while a request is already in flight no longer drops the
      // message — it's held in a queue (capped at maxQueuedMessages) and
      // dispatched 1:1 as each prior request resolves. Rendered as a stack
      // of cards above the composer; queueColors cycles per card so
      // consecutive queued messages stay visually distinct.
      maxQueuedMessages:  config.maxQueuedMessages  ?? 5,
      queueColors:        Array.isArray(config.queueColors) ? config.queueColors : null,
      queueItemTextColor: config.queueItemTextColor  ?? null,
      // ── Attachment chip colors ──────────────────────────────────────────
      attachmentChipBg:        config.attachmentChipBg        ?? null,
      attachmentChipBorder:    config.attachmentChipBorder    ?? null,
      attachmentChipIconColor: config.attachmentChipIconColor ?? null,
      attachmentChipTextColor: config.attachmentChipTextColor ?? null,
      };

      // normalized wins: each of its entries already folded in the
      // consumer's value (`config.x ?? default`), so this only restores the
      // defaults for keys the consumer omitted.
      return { ...config, ...normalized };
    },
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
  // Seed from config.initialMessages so a new instance can carry an existing
  // conversation over (e.g. "pop out to a tab" — snapshot via actions.getMessages
  // and pass the array here). Used once at mount.
  const [messages,      setMessages]      = useState(
    () => (Array.isArray(config.initialMessages) ? config.initialMessages : []),
  );
  const [input,         setInput]         = useState('');
  const [isTyping,      setIsTyping]      = useState(false);
  const [progressText,  setProgressText]  = useState('');
  const [auditRevision, setAuditRevision] = useState(0);
  // Pending "typed while a request was already in flight" messages — see
  // useChat.js's sendMessage / drain effect. Lives here (not local to
  // useChat) so an in-flight send-and-drain chain survives a mode switch.
  const [messageQueue,  setMessageQueue]  = useState([]);
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
    messageQueue,  setMessageQueue,
    threadRef,
    inputRef,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [messages, input, isTyping, progressText, auditRevision, replyContext, messageQueue]);

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

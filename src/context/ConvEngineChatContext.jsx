import { createContext, useContext, useMemo, useState, useRef } from 'react';
import { createApiClient } from '../api/client.js';
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
    () => createApiClient(config.apiHost ?? ''),
    [config.apiHost],
  );

  const resolvedConfig = useMemo(
    () => ({
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
      // ── Renderers & callbacks ──────────────────────────────────────────
      rendererProviders: Array.isArray(config.renderers) ? config.renderers : [],
      onMessage:  config.onMessage  ?? null,
      onResponse: config.onResponse ?? null,
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
    }),
    // Config values compared shallowly; stringify avoids over-rerendering on
    // inline object literals while still reacting to genuine changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(config)],
  );

  const ctx = useMemo(
    () => ({ conversationId, apiClient, config: resolvedConfig }),
    [conversationId, apiClient, resolvedConfig],
  );

  // ── Shared chat state — lives here so it survives mode switches ──────────
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [isTyping,      setIsTyping]      = useState(false);
  const [progressText,  setProgressText]  = useState('');
  const [auditRevision, setAuditRevision] = useState(0);
  const threadRef = useRef(null);
  const inputRef  = useRef(null);

  const chatState = useMemo(() => ({
    messages,      setMessages,
    input,         setInput,
    isTyping,      setIsTyping,
    progressText,  setProgressText,
    auditRevision, setAuditRevision,
    threadRef,
    inputRef,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [messages, input, isTyping, progressText, auditRevision]);

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

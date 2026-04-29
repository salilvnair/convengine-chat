import { createContext, useContext, useMemo } from 'react';
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
      title: config.title ?? 'How can I help you today?',
      placeholder: config.placeholder ?? 'Ask ConvEngine…',
      showAudit: config.showAudit ?? false,
      showFeedback: config.showFeedback ?? true,
      showDarkModeLightMode: config.showDarkModeLightMode ?? false,
      rendererProviders: Array.isArray(config.renderers) ? config.renderers : [],
      onMessage: config.onMessage ?? null,
      onResponse: config.onResponse ?? null,
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

  return (
    <ConvEngineChatContext.Provider value={ctx}>
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

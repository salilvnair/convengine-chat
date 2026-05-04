import { useCallback, useMemo, useState } from 'react';
import { useConvEngineChatContext } from '../context/ConvEngineChatContext.jsx';
import { stringifyPayload, extractEngineStatus } from '../utils/messagePayload.js';
import { containsMarkdownTable } from '../utils/assistantContent.js';
import { createClientId } from '../utils/uuid.js';

/**
 * Applies messageEnrichment config before the text reaches the API.
 *
 * text mode → apiText = prefix + userText + postfix (sent as the message string)
 * json mode → apiText = userText (unchanged); enrichment fields are merged into
 *             inputParams so the backend receives { prefix, userText, postfix, ...props, ...rendererParams }
 *             Renderer-supplied inputParams take precedence over enrichment props on collision.
 *
 * The user bubble always shows the original userText — enrichment is invisible in the UI
 * and only visible to the backend (intent classifier, etc.) and the audit panel.
 *
 * @param {string} userText           - The raw text the user typed / renderer display text.
 * @param {object|null} enrichment    - config.messageEnrichment
 * @param {object} [existingParams]   - inputParams already supplied by a renderer (merged in json mode)
 */
function buildEnrichedPayload(userText, enrichment, existingParams) {
  if (!enrichment || !enrichment.mode || enrichment.mode === 'none') {
    return { apiText: userText, inputParams: existingParams };
  }
  const { mode, prefix = '', postfix = '', props = {} } = enrichment;
  if (mode === 'json') {
    // enrichment props are the base; renderer's own inputParams override on collision
    const merged = { prefix, userText, postfix, ...props, ...(existingParams ?? {}) };
    return { apiText: userText, inputParams: merged };
  }
  // text mode — trim prefix/postfix and join with a single space so "/faq" + text = "/faq text"
  const p = prefix.trim();
  const s = postfix.trim();
  return {
    apiText: `${p ? p + ' ' : ''}${userText}${s ? ' ' + s : ''}`,
    inputParams: existingParams,
  };
}

/**
 * Core chat state & actions hook.
 * Encapsulates all send / feedback / scroll logic so UI components stay thin.
 */
export function useChat() {
  const { conversationId, apiClient, config, chatState } = useConvEngineChatContext();

  // All core state lives in context so it survives mode switches (panel ↔ sidepanel etc.)
  const {
    messages,      setMessages,
    input,         setInput,
    isTyping,      setIsTyping,
    progressText,  setProgressText,
    auditRevision, setAuditRevision,
    threadRef,
    inputRef,
  } = chatState;

  const [engineStatus, setEngineStatus] = useState(null);

  // ── Derived state ────────────────────────────────────────────────────────
  const isInitial = useMemo(
    () => messages.length === 0 && !isTyping,
    [messages.length, isTyping],
  );

  const normalizedInput = input.replace(/\s+$/g, '');
  const isMultiLine =
    normalizedInput.length > 0 &&
    (normalizedInput.includes('\n') || normalizedInput.length > 90);

  // ── Scroll to bottom whenever messages / typing change ──────────────────
  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // ── Send a message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const userText = input.trim();
    if (!userText || isTyping) return;

    config.onMessage?.(userText);
    setInput('');
    setProgressText('');
    setMessages((m) => [
      ...m,
      { id: createClientId(), role: 'user', text: userText },
    ]);
    setIsTyping(true);
    const _t0 = performance.now();

    try {
      const { apiText, inputParams } = buildEnrichedPayload(userText, config.messageEnrichment, undefined);
      const res = await apiClient.sendMessage(conversationId, apiText, inputParams);
      const elapsed = Math.round(performance.now() - _t0);
      const assistantText = stringifyPayload(
        res?.payload?.value ?? res?.payload ?? '',
      );
      setEngineStatus({ ...extractEngineStatus(res), elapsed });
      setMessages((m) => [
        ...m,
        {
          id: createClientId(),
          role: 'assistant',
          text: assistantText,
          feedback: null,
          feedbackBusy: false,
        },
      ]);
      setAuditRevision((v) => v + 1);
      config.onResponse?.(assistantText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setMessages((m) => [
        ...m,
        { id: createClientId(), role: 'assistant', text: `Error: ${message}` },
      ]);
    } finally {
      setIsTyping(false);
      setProgressText('');
      // Micro-defer so the DOM has updated before we scroll
      requestAnimationFrame(scrollToBottom);
    }
  }, [input, isTyping, conversationId, apiClient, config, scrollToBottom]);

  // ── Renderer-initiated send ─────────────────────────────────────────────
  /**
   * Programmatic send triggered by an interactive renderer Component.
   *
   * @param {string} displayText  - Text shown as the user turn bubble.
   *                                Pass an empty string to skip the user bubble.
   * @param {object} inputParams  - Arbitrary data forwarded to the backend
   *                                as `inputParams`.
   */
  const submitFromRenderer = useCallback(
    async (displayText, inputParams = {}) => {
      if (isTyping) return;
      const userText = String(displayText ?? '').trim();

      config.onMessage?.(userText);
      setProgressText('');

      // Only add a user bubble when there is visible text
      if (userText) {
        setMessages((m) => [
          ...m,
          { id: createClientId(), role: 'user', text: userText },
        ]);
      }
      setIsTyping(true);

      try {
        const { apiText, inputParams: enrichedParams } = buildEnrichedPayload(
          userText,
          config.messageEnrichment,
          inputParams,
        );
        const res = await apiClient.sendMessage(
          conversationId,
          apiText,
          enrichedParams,
        );
        const assistantText = stringifyPayload(
          res?.payload?.value ?? res?.payload ?? '',
        );
        setEngineStatus(extractEngineStatus(res));
        setMessages((m) => [
          ...m,
          {
            id: createClientId(),
            role: 'assistant',
            text: assistantText,
            feedback: null,
            feedbackBusy: false,
          },
        ]);
        setAuditRevision((v) => v + 1);
        config.onResponse?.(assistantText);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setMessages((m) => [
          ...m,
          { id: createClientId(), role: 'assistant', text: `Error: ${message}` },
        ]);
      } finally {
        setIsTyping(false);
        setProgressText('');
        requestAnimationFrame(scrollToBottom);
      }
    },
    [isTyping, conversationId, apiClient, config, scrollToBottom],
  );

  // ── submitSilent — send to backend with no user bubble ───────────────────
  /**
   * Send inputParams to the backend without adding a user turn bubble.
   * Useful for multi-step flows where the "message" is implicit.
   *
   * @param {object} inputParams - Forwarded to the backend as `inputParams`.
   */
  const submitSilent = useCallback(
    (inputParams = {}) => submitFromRenderer('', inputParams),
    [submitFromRenderer],
  );

  // ── appendBubble — add a bubble client-side without an API call ──────────
  /**
   * Inject a bubble into the thread without calling the backend.
   * Useful for local confirmations, validation messages, or step labels.
   *
   * @param {string} text  - Bubble text content.
   * @param {'user'|'assistant'} [role='assistant'] - Which side it appears on.
   */
  const appendBubble = useCallback(
    (text, role = 'assistant') => {
      setMessages((m) => [
        ...m,
        { id: createClientId(), role, text },
      ]);
      requestAnimationFrame(scrollToBottom);
    },
    [scrollToBottom],
  );

  // ── prefillInput — populate the composer without sending ────────────────
  /**
   * Pre-populate the composer text input so the user can review / edit
   * before manually sending.
   *
   * @param {string} text - Value to set in the composer.
   */
  const prefillInput = useCallback(
    (text) => {
      setInput(String(text ?? ''));
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [],
  );

  // ── resetChat — clear all conversation state ─────────────────────────────
  const resetChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setIsTyping(false);
    setProgressText('');
    setEngineStatus(null);
    setAuditRevision(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ── Enter key handler ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      sendMessage();
    },
    [sendMessage],
  );

  // ── Feedback ─────────────────────────────────────────────────────────────
  const submitFeedback = useCallback(
    async (messageId, feedbackType) => {
      if (!messageId || !feedbackType) return;

      let target = null;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          target = msg;
          return { ...msg, feedbackBusy: true };
        }),
      );
      if (!target) return;

      try {
        await apiClient.submitFeedback({
          conversationId,
          feedbackType,
          messageId: target.id,
          assistantResponse: target.text,
          metadata: {
            role: target.role,
            hasMarkdownTable: containsMarkdownTable(target.text),
          },
        });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, feedback: feedbackType, feedbackBusy: false }
              : msg,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, feedbackBusy: false } : msg,
          ),
        );
      }
    },
    [conversationId, apiClient],
  );

  return {
    // State
    messages,
    input,
    setInput,
    isTyping,
    progressText,
    engineStatus,
    auditRevision,
    isInitial,
    isMultiLine,
    // Refs
    threadRef,
    inputRef,
    // Actions
    sendMessage,
    submitFromRenderer,
    submitSilent,
    appendBubble,
    prefillInput,
    resetChat,
    handleKeyDown,
    submitFeedback,
    scrollToBottom,
  };
}

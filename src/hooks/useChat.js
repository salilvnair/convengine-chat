import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvEngineChatContext } from '../context/ConvEngineChatContext.jsx';
import { stringifyPayload, extractEngineStatus } from '../utils/messagePayload.js';
import { containsMarkdownTable } from '../utils/assistantContent.js';
import { createClientId } from '../utils/uuid.js';

// ── Stream helpers (mirrors convengine-ui App.jsx pattern) ────────────────────

const MIN_PROGRESS_VISIBLE_MS = 9000;

function extractVerboseText(streamEvent) {
  const payload = streamEvent?.data;
  if (!payload || typeof payload !== 'object') return '';
  const verbose =
    (payload.verbose && typeof payload.verbose === 'object' && payload.verbose) ||
    (payload.payload && typeof payload.payload === 'object' &&
      payload.payload.verbose && typeof payload.payload.verbose === 'object' &&
      payload.payload.verbose) ||
    null;
  if (!verbose) return '';
  if (typeof verbose.text === 'string' && verbose.text.trim()) return verbose.text.trim();
  if (typeof verbose.message === 'string' && verbose.message.trim()) return verbose.message.trim();
  if (typeof verbose.errorMessage === 'string' && verbose.errorMessage.trim()) return verbose.errorMessage.trim();
  return '';
}

function resolveStage(streamEvent) {
  if (typeof streamEvent?.stage === 'string' && streamEvent.stage.trim()) return streamEvent.stage.trim();
  const payload = streamEvent?.data;
  if (payload && typeof payload === 'object' && typeof payload.stage === 'string') return payload.stage.trim();
  return '';
}

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
  const { conversationId, apiClient, streamClient, config, chatState } = useConvEngineChatContext();

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

  // ── Stream subscription ───────────────────────────────────────────────────
  // Mirrors convengine-ui App.jsx pattern:
  //   • Every SSE/STOMP event increments auditRevision → AuditPanel refetches
  //   • VERBOSE events surface as progressText in the typing indicator
  //   • ASSISTANT_OUTPUT / ENGINE_RETURN clear the progress text smoothly
  const progressShownAtRef = useRef(0);
  const progressTimerRef   = useRef(null);
  const clearTimerRef      = useRef(null);
  const queuedProgressRef  = useRef('');

  useEffect(() => {
    if (!streamClient || !conversationId) return;

    const clearProgressTimers = () => {
      if (progressTimerRef.current) { clearTimeout(progressTimerRef.current); progressTimerRef.current = null; }
      if (clearTimerRef.current)    { clearTimeout(clearTimerRef.current);    clearTimerRef.current    = null; }
    };

    const commitProgressText = (text) => {
      setProgressText(text);
      progressShownAtRef.current = Date.now();
    };

    const scheduleQueuedProgress = (delayMs) => {
      if (progressTimerRef.current) return;
      progressTimerRef.current = setTimeout(() => {
        progressTimerRef.current = null;
        const next = queuedProgressRef.current;
        queuedProgressRef.current = '';
        if (next) commitProgressText(next);
      }, Math.max(0, delayMs));
    };

    const applyProgressText = (text) => {
      if (!text) return;
      setProgressText((current) => {
        if (!current) { progressShownAtRef.current = Date.now(); return text; }
        if (current === text) return current;
        const elapsed = Date.now() - progressShownAtRef.current;
        if (elapsed >= MIN_PROGRESS_VISIBLE_MS) { progressShownAtRef.current = Date.now(); return text; }
        queuedProgressRef.current = text;
        scheduleQueuedProgress(MIN_PROGRESS_VISIBLE_MS - elapsed);
        return current;
      });
    };

    const clearProgressTextSmoothly = () => {
      queuedProgressRef.current = '';
      if (progressTimerRef.current) { clearTimeout(progressTimerRef.current); progressTimerRef.current = null; }
      setProgressText((current) => {
        if (!current) return '';
        const elapsed = Date.now() - progressShownAtRef.current;
        if (elapsed >= MIN_PROGRESS_VISIBLE_MS) return '';
        if (!clearTimerRef.current) {
          clearTimerRef.current = setTimeout(() => {
            clearTimerRef.current = null;
            setProgressText('');
          }, MIN_PROGRESS_VISIBLE_MS - elapsed);
        }
        return current;
      });
    };

    const subscription = streamClient.subscribe(conversationId, {
      onConnected: () => setAuditRevision((v) => v + 1),
      onEvent: (event) => {
        // Every event → bump auditRevision so AuditPanel refetches via REST
        setAuditRevision((v) => v + 1);
        // VERBOSE events → surface as progress text
        const text = extractVerboseText(event);
        if (text) {
          if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }
          applyProgressText(text);
        }
        // Final stages → clear progress text
        const stage = resolveStage(event).toUpperCase();
        if (stage === 'ASSISTANT_OUTPUT' || stage === 'ENGINE_RETURN') clearProgressTextSmoothly();
      },
      onError: () => {},
    });

    return () => {
      subscription.close();
      clearProgressTimers();
    };
  }, [streamClient, conversationId]);

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

  // useEffect guarantees scrolling AFTER React has committed DOM changes,
  // which is more reliable than requestAnimationFrame for React 18 batching.
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isTyping, scrollToBottom]);

  // ── Send a message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const userText = input.trim();
    if (!userText || isTyping) return;

    config.onMessage?.(userText);
    setInput('');
    setProgressText('');
    setMessages((m) => [
      ...m,
      { id: createClientId(), role: 'user', text: userText, sentAt: Date.now() },
    ]);
    setIsTyping(true);
    const _t0 = performance.now();

    try {
      // Debug: artificial delay before every response (0 = off)
      if (config.debugSimulateDelay > 0) {
        await new Promise((r) => setTimeout(r, config.debugSimulateDelay));
      }
      // Debug: always throw an error instead of calling the API
      if (config.debugSimulateError) {
        throw new Error('Simulated error (debugSimulateError is enabled)');
      }
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
          sentAt: Date.now(),
        },
      ]);
      setAuditRevision((v) => v + 1);
      config.onResponse?.(assistantText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setMessages((m) => [
        ...m,
        { id: createClientId(), role: 'assistant', text: `Error: ${message}`, sentAt: Date.now() },
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
          { id: createClientId(), role: 'user', text: userText, sentAt: Date.now() },
        ]);
      }
      setIsTyping(true);

      try {
        // Debug: artificial delay before every response (0 = off)
        if (config.debugSimulateDelay > 0) {
          await new Promise((r) => setTimeout(r, config.debugSimulateDelay));
        }
        // Debug: always throw an error instead of calling the API
        if (config.debugSimulateError) {
          throw new Error('Simulated error (debugSimulateError is enabled)');
        }
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
            sentAt: Date.now(),
          },
        ]);
        setAuditRevision((v) => v + 1);
        config.onResponse?.(assistantText);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        setMessages((m) => [
          ...m,
          { id: createClientId(), role: 'assistant', text: `Error: ${message}`, sentAt: Date.now() },
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
        { id: createClientId(), role, text, sentAt: Date.now() },
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

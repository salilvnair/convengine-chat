/**
 * Stream client factory for ConvEngine — supports SSE and STOMP WebSocket.
 *
 * Usage:
 *   const client = createStreamClient(apiHost, { transport: 'sse' });
 *   const sub = client.subscribe(conversationId, { onEvent, onError, onConnected, onClosed });
 *   sub.close();  // when done
 *
 * config.stream options:
 *   transport: 'sse' | 'stomp'   — default 'sse'
 *   wsBase:    string            — WebSocket base URL for STOMP (defaults to apiHost)
 */

const STREAM_STAGE_EVENTS = [
  'CONNECTED',
  'USER_INPUT',
  'DIALOGUE_ACT_LLM_INPUT',
  'DIALOGUE_ACT_LLM_OUTPUT',
  'STEP_ENTER',
  'STEP_EXIT',
  'STEP_ERROR',
  'ASSISTANT_OUTPUT',
  'ENGINE_RETURN',
  'MCP_TOOL_CALL',
  'MCP_TOOL_RESULT',
  'MCP_TOOL_ERROR',
  'MCP_FINAL_ANSWER',
  'TOOL_ORCHESTRATION_REQUEST',
  'TOOL_ORCHESTRATION_RESULT',
  'TOOL_ORCHESTRATION_ERROR',
  'RULE_MATCH',
  'RULE_APPLIED',
  'RULE_NO_MATCH',
  'PENDING_ACTION_EXECUTED',
  'PENDING_ACTION_REJECTED',
  'PENDING_ACTION_FAILED',
  'CORRECTION_STEP_RETRY_REQUESTED',
  'POLICY_BLOCK',
  'VERBOSE',
];

function noOpSubscription() {
  return { close() {} };
}

// ── SSE ──────────────────────────────────────────────────────────────────────

function subscribeViaSse(conversationId, handlers, convBase) {
  const source = new EventSource(`${convBase}/stream/${conversationId}`);

  source.onopen = () => handlers.onConnected?.();

  source.onmessage = (event) => {
    try {
      const parsed = event.data ? JSON.parse(event.data) : null;
      handlers.onEvent?.({ stage: 'MESSAGE', data: parsed, raw: event });
    } catch {
      handlers.onEvent?.({ stage: 'MESSAGE', data: null, raw: event });
    }
  };

  STREAM_STAGE_EVENTS.forEach((stage) => {
    source.addEventListener(stage, (event) => {
      try {
        const parsed = event.data ? JSON.parse(event.data) : null;
        handlers.onEvent?.({ stage, data: parsed, raw: event });
      } catch {
        handlers.onEvent?.({ stage, data: null, raw: event });
      }
    });
  });

  source.onerror = (err) => handlers.onError?.(err);

  return {
    close() {
      source.close();
      handlers.onClosed?.();
    },
  };
}

// ── STOMP WebSocket ───────────────────────────────────────────────────────────

function subscribeViaStomp(conversationId, handlers, wsBase) {
  const StompClient = globalThis?.StompJs?.Client;
  const SockJS = globalThis?.SockJS;

  if (!StompClient || !SockJS) {
    console.warn(
      '[convengine-chat] STOMP transport selected but StompJs/SockJS globals are missing.\n' +
      'Install @stomp/stompjs + sockjs-client and expose them on globalThis, or switch to SSE.',
    );
    handlers.onError?.(new Event('stomp_not_available'));
    return noOpSubscription();
  }

  const client = new StompClient({
    webSocketFactory: () => new SockJS(`${wsBase}/ws-convengine`),
    reconnectDelay: 5000,
    onConnect: () => {
      handlers.onConnected?.();
      client.subscribe(`/topic/convengine/audit/${conversationId}`, (msg) => {
        try {
          const parsed = msg.body ? JSON.parse(msg.body) : null;
          handlers.onEvent?.({ stage: parsed?.stage || 'MESSAGE', data: parsed, raw: msg });
        } catch {
          handlers.onEvent?.({ stage: 'MESSAGE', data: msg.body, raw: msg });
        }
      });
    },
    onStompError: (frame) => handlers.onError?.(frame),
    onWebSocketError: (err) => handlers.onError?.(err),
  });

  client.activate();

  return {
    close() {
      client.deactivate();
      handlers.onClosed?.();
    },
  };
}

// ── Public factory ────────────────────────────────────────────────────────────

/**
 * Creates a stream client bound to a ConvEngine backend host.
 *
 * @param {string} apiHost        — Base URL of the backend.
 * @param {object} streamConfig   — { transport?: 'sse'|'stomp', wsBase?: string }
 */
export function createStreamClient(apiHost, streamConfig = {}) {
  const base     = String(apiHost ?? '').replace(/\/+$/, '');
  const convBase = `${base}/api/v1/conversation`;
  const wsBase   = String(streamConfig.wsBase ?? apiHost ?? '').replace(/\/+$/, '');

  return {
    /**
     * Subscribe to the real-time event stream for a conversation.
     *
     * @param {string} conversationId
     * @param {object} handlers
     *   handlers.onEvent({ stage, data, raw }) — fired for every stream event
     *   handlers.onConnected()                 — fired when connection opens
     *   handlers.onError(err)                  — fired on connection error
     *   handlers.onClosed()                    — fired when close() is called
     * @returns {{ close(): void }}
     */
    subscribe(conversationId, handlers = {}) {
      const transport = String(streamConfig.transport ?? 'sse').toLowerCase();
      if (transport === 'stomp') {
        return subscribeViaStomp(conversationId, handlers, wsBase);
      }
      return subscribeViaSse(conversationId, handlers, convBase);
    },
  };
}

/**
 * Creates a typed API client bound to a ConvEngine backend host.
 *
 * @param {string} apiHost
 *   Base URL of the backend, e.g. "http://localhost:8080".
 *   Pass "" (empty string) for same-origin deployments.
 *
 * @param {object} [apiEndpoints]
 *   Override individual endpoint paths.  Each value is either:
 *     - a full URL:      "https://my-api.example.com/chat/send"
 *     - an abs path:     "/api/v1/message"   (resolved against the current origin)
 *   Unspecified endpoints fall back to {apiHost}/api/v1/conversation/{name}.
 *
 *   {
 *     message:  "/api/v1/message",
 *     feedback: "/api/v1/feedback",
 *     audit:    "/api/v1/audit",      // /{conversationId} is appended automatically
 *   }
 *
 * @returns {ConvEngineApiClient}
 */
export function createApiClient(apiHost, apiEndpoints = {}) {
  const base     = String(apiHost ?? '').replace(/\/+$/, '');
  const convBase = `${base}/api/v1/conversation`;

  // Resolve an endpoint URL: explicit override wins, otherwise fall back to convBase/{name}.
  function url(name) {
    const override = apiEndpoints?.[name];
    if (override) return String(override).replace(/\/+$/, '');
    return `${convBase}/${name}`;
  }

  return {
    /**
     * Sends a user message and returns the assistant response payload.
     */
    async sendMessage(conversationId, message, inputParams = {}, reset = false) {
      const res = await fetch(url('message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message, reset, inputParams }),
      });
      if (!res.ok) throw new Error(`ConvEngine API error: ${res.status} ${res.statusText}`);
      return res.json();
    },

    /**
     * Submits thumbs-up / thumbs-down feedback for a specific assistant message.
     */
    async submitFeedback({ conversationId, feedbackType, messageId, assistantResponse, metadata }) {
      const res = await fetch(url('feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, feedbackType, messageId, assistantResponse, metadata }),
      });
      if (!res.ok) throw new Error(`ConvEngine API error: ${res.status} ${res.statusText}`);
      return res.json();
    },

    /**
     * Fetches the full audit trail for a conversation.
     */
    async fetchAudit(conversationId) {
      const auditBase = url('audit');
      const res = await fetch(`${auditBase}/${encodeURIComponent(conversationId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`ConvEngine API error: ${res.status} ${res.statusText}`);
      return res.json();
    },
  };
}

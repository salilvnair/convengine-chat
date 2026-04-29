/**
 * Creates a typed API client bound to a ConvEngine backend host.
 *
 * @param {string} apiHost - Base URL of the ConvEngine backend, e.g. "http://localhost:8080"
 * @returns {ConvEngineApiClient}
 */
export function createApiClient(apiHost) {
  const base = String(apiHost ?? '').replace(/\/+$/, '');
  const convBase = `${base}/api/v1/conversation`;

  return {
    /**
     * Sends a user message and returns the assistant response payload.
     */
    async sendMessage(conversationId, message, inputParams = {}, reset = false) {
      const res = await fetch(`${convBase}/message`, {
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
      const res = await fetch(`${convBase}/feedback`, {
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
      const res = await fetch(`${convBase}/audit/${encodeURIComponent(conversationId)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`ConvEngine API error: ${res.status} ${res.statusText}`);
      return res.json();
    },
  };
}

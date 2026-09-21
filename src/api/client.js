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

    /**
     * Searches audit rows ACROSS conversations — the panel's "find an older
     * conversation" box, as opposed to filtering the trail already on screen.
     *
     * GET {auditBase}/search?q=…&limit=… , overridable as
     * `apiEndpoints.auditSearch` for backends that expose it elsewhere.
     * Either response shape is accepted:
     *
     *   [ { conversationId, auditId, stage, payloadJson, createdAt }, … ]
     *   { results: [ … same … ], total?: number }
     *
     * i.e. plain audit rows, so a hit renders with the same card as the live
     * trail rather than needing a second renderer.
     *
     * @param {string} query   free text matched against stage and payload
     * @param {object} [opts]
     * @param {number} [opts.limit=50]
     * @param {number} [opts.offset]
     * @param {string|string[]} [opts.stage]  exact stage, or the NAME of a
     *        withStage() form — RULE_MATCH also matches "RULE_MATCH (x)"
     * @param {string} [opts.conversationId]
     * @param {string} [opts.intent]   intent recorded in _meta at the time
     * @param {string} [opts.state]    state recorded in _meta at the time
     * @param {string} [opts.since]    ISO-8601
     * @param {string} [opts.until]    ISO-8601
     * @param {boolean} [opts.errorsOnly]
     * @returns {Promise<{results: Array, total: number}>}
     */
    async searchAudit(query, { limit = 50, ...filters } = {}) {
      const searchUrl = apiEndpoints?.auditSearch
        ? String(apiEndpoints.auditSearch).replace(/\/+$/, '')
        : `${url('audit')}/search`;
      const qs = new URLSearchParams({ q: query ?? '', limit: String(limit) });
      // Optional filters go on the wire only when set, so a backend that
      // implements just the base q/limit contract never sees params it rejects.
      for (const [key, value] of Object.entries(filters)) {
        if (value == null || value === '' || value === false) continue;
        qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
      const res = await fetch(`${searchUrl}?${qs}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`ConvEngine API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data : (data?.results ?? []);
      return { results, total: data?.total ?? results.length };
    },
  };
}

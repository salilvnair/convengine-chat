/**
 * Built-in renderer for ConvEngine FaqAnswer payload type.
 *
 * Matches when `payload.type === "FaqAnswer"` or when the response object
 * has the shape: { answer: string, confidence?: number, matchedFaqIds?: [] }
 *
 * Payload shape:
 *   {
 *     type?: "FaqAnswer",
 *     answer: string,
 *     confidence?: number,        // 0–1 float
 *     matchedFaqIds?: string[],
 *     faqIdsMatched?: string[],   // legacy alias
 *   }
 */
export function FaqAnswerRenderer({ payload }) {
  const answer = typeof payload?.answer === 'string' ? payload.answer : '';

  const matchedFaqIds = Array.isArray(payload?.matchedFaqIds)
    ? payload.matchedFaqIds
    : Array.isArray(payload?.faqIdsMatched)
      ? payload.faqIdsMatched
      : [];

  const confidenceRaw =
    typeof payload?.confidence === 'number' ? payload.confidence : null;
  const confidencePercent =
    confidenceRaw === null
      ? null
      : Math.max(0, Math.min(100, Math.round(confidenceRaw * 100)));

  return (
    <div className="ce-faq-answer">
      {/* Confidence badge — top-right corner of bubble */}
      {confidencePercent !== null && (
        <span
          className="ce-faq-confidence"
          title={`Confidence ${confidencePercent}%`}
          aria-label={`Confidence ${confidencePercent} percent`}
        >
          {confidencePercent}%
        </span>
      )}

      {/* FAQ ID chips */}
      {matchedFaqIds.length > 0 && (
        <div className="ce-faq-meta">
          {matchedFaqIds.map((id) => (
            <span key={id} className="ce-faq-chip" title={`FAQ ID: ${id}`}>
              FAQ {id}
            </span>
          ))}
        </div>
      )}

      <pre className="ce-bubble-text">{answer}</pre>
    </div>
  );
}

/** Renderer descriptor — registered with the RendererRegistry */
export const faqAnswerRendererProvider = {
  key: 'FaqAnswer',
  priority: 100,
  match: ({ payload, effectiveType }) => {
    if (!payload || typeof payload !== 'object') return false;
    if (effectiveType === 'FaqAnswer') return true;
    const hasAnswer = typeof payload.answer === 'string';
    const hasFaqArray =
      Array.isArray(payload.matchedFaqIds) || Array.isArray(payload.faqIdsMatched);
    const hasConfidence = typeof payload.confidence === 'number';
    return hasAnswer && (hasFaqArray || hasConfidence);
  },
  Component: FaqAnswerRenderer,
};

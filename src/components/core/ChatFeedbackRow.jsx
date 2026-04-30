import { useIcons } from '../../hooks/useIcons.js';

/**
 * Thumbs-up / thumbs-down row rendered below each assistant message.
 */
export function ChatFeedbackRow({ bubble, onFeedback }) {
  const { ThumbDownIcon, ThumbUpIcon } = useIcons();
  return (
    <div className="ce-feedback-row" role="group" aria-label="Rate this response">
      <button
        type="button"
        className={`ce-feedback-btn ${bubble.feedback === 'THUMBS_UP' ? 'ce-feedback-btn--active' : ''}`}
        title="Helpful"
        aria-label="Mark as helpful"
        aria-pressed={bubble.feedback === 'THUMBS_UP'}
        disabled={!!bubble.feedbackBusy}
        onClick={() => onFeedback(bubble.id, 'THUMBS_UP')}
      >
        <ThumbUpIcon />
      </button>
      <button
        type="button"
        className={`ce-feedback-btn ${bubble.feedback === 'THUMBS_DOWN' ? 'ce-feedback-btn--active' : ''}`}
        title="Not helpful"
        aria-label="Mark as not helpful"
        aria-pressed={bubble.feedback === 'THUMBS_DOWN'}
        disabled={!!bubble.feedbackBusy}
        onClick={() => onFeedback(bubble.id, 'THUMBS_DOWN')}
      >
        <ThumbDownIcon />
      </button>
    </div>
  );
}

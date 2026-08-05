import { useState } from 'react';
import { useIcons } from '../../hooks/useIcons.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';

/**
 * Thumbs-up / thumbs-down row rendered below each assistant message.
 *
 * Optionally collects a written correction before submitting — see
 * `config.feedback.requireCommentOn`. A bare thumbs-down says an answer was
 * wrong and nothing more; for a backend that FEEDS ON its feedback (one that
 * propagates corrections into a knowledge base, retrains, or files a review
 * task) that is not merely unhelpful, it is harmful — every down-vote writes
 * a "this was bad, no idea why" record. Asking what the answer should have
 * been, at the moment someone is annoyed enough to click, is what makes a
 * correction loop self-correcting instead of self-polluting.
 */
export function ChatFeedbackRow({ bubble, onFeedback }) {
  const { ThumbDownIcon, ThumbUpIcon } = useIcons();
  const { config } = useConvEngineChatContext();
  const fb = config.feedback ?? {};
  const requireOn = fb.requireCommentOn ?? 'none';

  const [commentFor, setCommentFor] = useState(null); // 'THUMBS_UP' | 'THUMBS_DOWN' | null
  const [comment, setComment] = useState('');

  const needsComment = (type) =>
    requireOn === 'always' || (requireOn === 'negative' && type === 'THUMBS_DOWN');

  const click = (type) => {
    if (needsComment(type)) { setCommentFor(type); setComment(''); return; }
    onFeedback(bubble.id, type);
  };

  const submitComment = () => {
    const text = comment.trim();
    // Optional by default: someone who clicked the thumb has already given you
    // the useful bit, and refusing to record it until they write prose loses
    // the signal entirely. `requireCommentText` opts into the stricter rule
    // for apps that would rather have nothing than an unexplained vote.
    if (fb.requireCommentText && !text) return;
    onFeedback(bubble.id, commentFor, text);
    setCommentFor(null);
    setComment('');
  };

  return (
    <div className="ce-feedback-wrap">
      <div className="ce-feedback-row" role="group" aria-label="Rate this response">
        <button
          type="button"
          className={`ce-feedback-btn ce-feedback-btn--up ${bubble.feedback === 'THUMBS_UP' ? 'ce-feedback-btn--active' : ''}`}
          title={fb.upLabel ?? 'Helpful'}
          aria-label={fb.upLabel ?? 'Mark as helpful'}
          aria-pressed={bubble.feedback === 'THUMBS_UP'}
          onClick={() => click('THUMBS_UP')}
        >
          <ThumbUpIcon />
        </button>
        <button
          type="button"
          className={`ce-feedback-btn ce-feedback-btn--down ${bubble.feedback === 'THUMBS_DOWN' ? 'ce-feedback-btn--active' : ''}`}
          title={fb.downLabel ?? 'Not helpful'}
          aria-label={fb.downLabel ?? 'Mark as not helpful'}
          aria-pressed={bubble.feedback === 'THUMBS_DOWN'}
          onClick={() => click('THUMBS_DOWN')}
        >
          <ThumbDownIcon />
        </button>
        {bubble.feedback && !commentFor && (
          <span className="ce-feedback-thanks">
            {bubble.feedback === 'THUMBS_UP'
              ? (fb.thanksUpText ?? 'Thanks!')
              : (fb.thanksDownText ?? 'Thanks — noted.')}
          </span>
        )}
      </div>

      {commentFor && (
        <div className="ce-feedback-comment">
          <textarea
            className="ce-feedback-comment-input"
            rows={3}
            autoFocus
            value={comment}
            placeholder={
              commentFor === 'THUMBS_DOWN'
                ? (fb.commentPlaceholder ?? 'What should the answer have been?')
                : (fb.commentPlaceholderPositive ?? fb.commentPlaceholder ?? 'Anything worth adding?')
            }
            onChange={(e) => setComment(e.target.value)}
            // Enter submits, Shift+Enter newlines, Escape backs out — the same
            // contract as the composer, so the muscle memory carries over.
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setCommentFor(null); return; }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
            }}
          />
          <div className="ce-feedback-comment-btns">
            <button type="button" className="ce-feedback-cancel" onClick={() => setCommentFor(null)}>
              {fb.commentCancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className="ce-feedback-submit"
              disabled={fb.requireCommentText && !comment.trim()}
              onClick={submitComment}
            >
              {fb.commentSubmitLabel ?? 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { AgentIcon } from '../../icons/Icons.jsx';

/**
 * Animated "Agent is thinking…" indicator shown while awaiting a response.
 */
export function ChatTypingIndicator({ progressText }) {
  const label =
    typeof progressText === 'string' && progressText.trim()
      ? progressText
      : 'Agent is thinking…';

  return (
    <article className="ce-message ce-message-assistant ce-message-thinking" aria-live="polite">
      <div className="ce-avatar ce-avatar--agent ce-avatar--thinking">
        <AgentIcon />
      </div>
      <div className="ce-message-content">
        <div className="ce-thinking-strip">
          <span className="ce-thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="ce-thinking-text">{label}</span>
        </div>
      </div>
    </article>
  );
}

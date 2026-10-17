import { useIcons } from '../../hooks/useIcons.js';

/**
 * Animated "Agent is thinking…" indicator shown while awaiting a response.
 * With `renderer` (config.thinkingRenderer) that component takes the place of the dots strip,
 * next to the agent avatar; it gets the latest progress text.
 */
export function ChatTypingIndicator({ progressText, renderer: Renderer = null }) {
  const { AgentIcon } = useIcons();
  const label =
    typeof progressText === 'string' && progressText.trim()
      ? progressText
      : 'Agent is thinking…';

  return (
    <article className={`ce-message ce-message-assistant ce-message-thinking${Renderer ? ' ce-message-thinking--custom' : ''}`} aria-live="polite">
      <div className="ce-message-row">
        <div className="ce-avatar ce-avatar--agent ce-avatar--thinking">
          <AgentIcon />
        </div>
        <div className="ce-message-content">
          {Renderer ? <Renderer progressText={label} rawProgressText={progressText ?? ''} /> : (
          <div className="ce-thinking-strip">
            <span className="ce-thinking-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="ce-thinking-text">{label}</span>
          </div>
          )}
        </div>
      </div>
    </article>
  );
}

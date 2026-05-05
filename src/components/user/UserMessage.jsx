import { useIcons } from '../../hooks/useIcons.js';
import { bubbleShapeClass } from '../../utils/messageBubble.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { formatTime } from '../../utils/dateFormat.js';

/** HH:mm:ss (24h) from a Unix ms timestamp — for debug chips only. */
function fmtTime(ts) {
  if (ts == null) return '';
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Renders a single user message bubble (right-aligned).
 */
export function UserMessage({ bubble }) {
  const { config } = useConvEngineChatContext();
  const { UserIcon } = useIcons();
  const hasDebugChips = config.debugShowMessageId || config.debugShowTimestamps;
  const timeCaption = config.showBubbleTime && bubble.sentAt != null ? (
    <span className="ce-bubble-time">{formatTime(bubble.sentAt, config.bubbleTimeFormat ?? 'h:mm A')}</span>
  ) : null;
  return (
    <article className="ce-message ce-message--user">
      <div className="ce-avatar ce-avatar--user" aria-hidden="true">
        <UserIcon />
      </div>
      <div className="ce-message-content">
        <div className={`ce-bubble ce-bubble--user ${bubbleShapeClass(bubble.text)}`}>
          <pre className="ce-bubble-text">{bubble.text}</pre>
        </div>
        {timeCaption}
        {hasDebugChips && (
          <div className="ce-debug-chips" style={{ justifyContent: 'flex-end' }}>
            {config.debugShowTimestamps && bubble.sentAt != null && (
              <span className="ce-debug-chip ce-debug-chip--time">{fmtTime(bubble.sentAt)}</span>
            )}
            {config.debugShowMessageId && (
              <span className="ce-debug-chip ce-debug-chip--id">id:{bubble.id.slice(0, 8)}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

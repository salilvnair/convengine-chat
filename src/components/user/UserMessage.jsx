import { useIcons } from '../../hooks/useIcons.js';
import { bubbleShapeClass } from '../../utils/messageBubble.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { formatTime } from '../../utils/dateFormat.js';
import { formatBytes } from '../../utils/attachments.js';

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
      <div className="ce-message-row">
        <div className="ce-avatar ce-avatar--user" aria-hidden="true">
          <UserIcon />
        </div>
        <div className="ce-message-content">
          <div className={`ce-bubble ce-bubble--user ${bubble.reply ? 'ce-bubble--has-reply' : ''} ${bubbleShapeClass(bubble.text)}`}>
            {bubble.reply && (
              <span
                className="ce-bubble-reply-quote"
                style={bubble.reply.accent ? { '--ce-reply-accent': bubble.reply.accent } : undefined}
              >
                {bubble.reply.label && <span className="ce-bubble-reply-quote-label">{bubble.reply.label}</span>}
                <span className="ce-bubble-reply-quote-text">{bubble.reply.text}</span>
              </span>
            )}
            {bubble.files?.length > 0 && (
              /* What was attached, recorded on the bubble itself — a
                 transcript that says only "a file was sent" is useless when
                 you scroll back to work out which one. */
              <span className="ce-bubble-files">
                {bubble.files.map((f, i) => (
                  <span className="ce-bubble-file" key={`${f.name}-${i}`} title={f.name}>
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none"
                         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                         strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
                      <path d="M9 1.5v4h4" />
                    </svg>
                    <span className="ce-bubble-file-name">{f.name}</span>
                    {f.size != null && (
                      <span className="ce-bubble-file-size">{formatBytes(f.size)}</span>
                    )}
                  </span>
                ))}
              </span>
            )}
            {bubble.text && <span className="ce-bubble-text">{bubble.text}</span>}
          </div>
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
      </div>
      {timeCaption}
    </article>
  );
}

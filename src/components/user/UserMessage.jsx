import { useIcons } from '../../hooks/useIcons.js';
import { bubbleShapeClass } from '../../utils/messageBubble.js';

/**
 * Renders a single user message bubble (right-aligned).
 */
export function UserMessage({ bubble }) {
  const { UserIcon } = useIcons();
  return (
    <article className="ce-message ce-message--user">
      <div className="ce-message-content">
        <div className={`ce-bubble ce-bubble--user ${bubbleShapeClass(bubble.text)}`}>
          <pre className="ce-bubble-text">{bubble.text}</pre>
        </div>
      </div>
      <div className="ce-avatar ce-avatar--user" aria-hidden="true">
        <UserIcon />
      </div>
    </article>
  );
}

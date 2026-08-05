/**
 * Pending-send queue strip — Claude Code / Codex style.
 *
 * Rendered above the composer's input box (attachments for the message
 * currently being drafted render above this, so the stack reads top-to-
 * bottom as: attachments → queued messages → the box you're typing in).
 *
 * Each card cycles through up to 5 accent colors (config.queueColors) so
 * consecutive queued messages stay visually distinct, and carries a ✕ to
 * cancel that one message before it's ever sent.
 */
export function ChatMessageQueue({ queue, onCancel }) {
  if (!queue || queue.length === 0) return null;
  return (
    <div className="ce-message-queue" role="list" aria-label="Queued messages">
      {queue.map((item, i) => {
        const fileCount = item.files?.length ?? 0;
        return (
          <div key={item.id} className={`ce-queue-item ce-queue-item--${(i % 5) + 1}`} role="listitem">
            <span className="ce-queue-item-index" aria-hidden="true">{i + 1}</span>
            <span className="ce-queue-item-text">
              {item.userText || (fileCount ? `${fileCount} file${fileCount === 1 ? '' : 's'}` : '')}
            </span>
            {fileCount > 0 && item.userText && (
              <span className="ce-queue-item-files" title={`${fileCount} attachment(s)`}>
                📎 {fileCount}
              </span>
            )}
            <button
              type="button"
              className="ce-queue-item-x"
              onClick={() => onCancel?.(item.id)}
              title="Cancel this queued message"
              aria-label="Cancel this queued message"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

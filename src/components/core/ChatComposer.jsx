import { useEffect, useRef } from 'react';
import { useIcons } from '../../hooks/useIcons.js';
import { formatBytes } from '../../utils/attachments.js';

/**
 * Textarea + send button composition.
 * Auto-grows vertically up to a max-height of ~168 px.
 *
 * Attachments sit in a toolbar UNDER the input, next to the send button, the
 * way every coding assistant does it — a "+" on the left, actions on the
 * right. Picked files appear as chips ABOVE the input so they read as part of
 * the message being composed rather than as something already sent.
 *
 * @param {{ centered?: boolean }} props
 */
export function ChatComposer({
  inputRef,
  input,
  isTyping,
  isMultiLine,
  onInputChange,
  onKeyDown,
  onSend,
  placeholder = 'Ask ConvEngine…',
  centered = false,
  fullscreen = false,
  shape = 'round',
  reply = null,
  // ── attachments ──
  attachmentsEnabled = false,
  attachments = [],
  attachmentError = '',
  acceptFileTypes = '',
  onFilesPicked,
  onRemoveAttachment,
  // ── identity ──
  agentName = '',
}) {
  const { SendIcon } = useIcons();
  const fileInputRef = useRef(null);
  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;
    if (!input.trim()) {
      el.style.height = '';
      return;
    }
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input, inputRef]);

  const composerClass = [
    'ce-composer',
    centered    ? 'ce-composer--centered'    : '',
    isMultiLine ? 'ce-composer--multiline'   : '',
    fullscreen  ? 'ce-composer--fullscreen'  : '',
    shape === 'rect' ? 'ce-composer--rect' : '',
    reply ? 'ce-composer--has-reply' : '',
    attachmentsEnabled ? 'ce-composer--has-toolbar' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const showToolbar = attachmentsEnabled || Boolean(agentName);

  const replyClickable = reply && typeof reply.onClick === 'function';

  return (
    <div className={composerClass}>
      {reply && (
        <div
          className="ce-composer-reply"
          style={reply.accent ? { '--ce-reply-accent': reply.accent } : undefined}
        >
          <button
            type="button"
            className="ce-composer-reply-main"
            data-clickable={replyClickable ? '1' : undefined}
            onClick={replyClickable ? reply.onClick : undefined}
            title={reply.title ?? (replyClickable ? 'Open' : undefined)}
          >
            <span className="ce-composer-reply-bar" />
            <span className="ce-composer-reply-text">
              {reply.label && <span className="ce-composer-reply-label">{reply.label}</span>}
              <span className="ce-composer-reply-quote">{reply.text}</span>
            </span>
          </button>
          {reply.clearable !== false && (
            <button
              type="button"
              className="ce-composer-reply-x"
              onClick={reply.onClear}
              title="Remove context"
              aria-label="Remove context"
            >
              ✕
            </button>
          )}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="ce-composer-files">
          {attachments.map((file, i) => (
            <span className="ce-file-chip" key={`${file.name}-${i}`} title={file.name}>
              <span className="ce-file-chip-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none"
                     stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                     strokeLinejoin="round">
                  <path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z" />
                  <path d="M9 1.5v4h4" />
                </svg>
              </span>
              <span className="ce-file-chip-name">{file.name}</span>
              <span className="ce-file-chip-size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="ce-file-chip-x"
                onClick={() => onRemoveAttachment?.(i)}
                title={`Remove ${file.name}`}
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {attachmentError && (
        <div className="ce-composer-file-error" role="alert">{attachmentError}</div>
      )}

      <textarea
        ref={inputRef}
        className="ce-composer-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={isTyping}
        rows={1}
        aria-label="Message input"
        aria-multiline="true"
      />

      {showToolbar ? (
        <div className="ce-composer-toolbar">
          {attachmentsEnabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptFileTypes || undefined}
                className="ce-composer-file-input"
                onChange={(e) => {
                  onFilesPicked?.(e.target.files);
                  // Reset so picking the SAME file again still fires change.
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                className="ce-composer-attach"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping}
                title="Attach files"
                aria-label="Attach files"
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none"
                     stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
              </button>
            </>
          )}
          <span className="ce-composer-toolbar-spacer" />
          {agentName && <span className="ce-composer-agent">{agentName}</span>}
          <button
            type="button"
            className="ce-composer-send"
            onClick={onSend}
            disabled={isTyping || (!input.trim() && attachments.length === 0)}
            title="Send message"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ce-composer-send"
          onClick={onSend}
          disabled={isTyping || !input.trim()}
          title="Send message"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      )}
    </div>
  );
}

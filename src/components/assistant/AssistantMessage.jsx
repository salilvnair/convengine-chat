import { useIcons } from '../../hooks/useIcons.js';
import { bubbleShapeClass, isAssistantErrorBubble } from '../../utils/messageBubble.js';
import { containsMarkdownTable } from '../../utils/assistantContent.js';
import { resolveAssistantRenderer } from '../../renderers/core/RendererRegistry.jsx';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useChatActions } from '../../context/ChatActionsContext.jsx';
import { formatTime } from '../../utils/dateFormat.js';

/** Tiny monospace chip used by all debug overlays. */
function DebugChip({ variant, children }) {
  return <span className={`ce-debug-chip ce-debug-chip--${variant}`}>{children}</span>;
}

/** HH:mm:ss from a Unix ms timestamp (24h — for debug chips only). */
function fmtTime(ts) {
  if (ts == null) return '';
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Renders a single assistant message bubble (left-aligned).
 *
 * - Resolves the appropriate renderer from the registry (supports custom renderers
 *   registered via `config.renderers`).
 * - Shows an error state for "Error:" prefixed messages.
 * - Applies a wider layout when the response contains a markdown table.
 */
export function AssistantMessage({ bubble }) {
  const { config } = useConvEngineChatContext();
  const { actions } = useChatActions();
  const { AgentIcon } = useIcons();

  const isError = isAssistantErrorBubble(bubble);
  const resolved = !isError
    ? resolveAssistantRenderer(bubble.text, config.rendererProviders)
    : null;

  const hasTable =
    !isError &&
    resolved?.key === 'default' &&
    containsMarkdownTable(bubble.text);

  // When a provider declares hideBubble:true the bubble shell is skipped;
  // the renderer component controls its own presentation entirely.
  const hideBubble = !isError && resolved?.hideBubble === true;

  const Renderer = resolved?.Component;

  // ── Time caption (showBubbleTime) —————————————————————————————————————
  const timeCaption = config.showBubbleTime && bubble.sentAt != null ? (
    <span className="ce-bubble-time">{formatTime(bubble.sentAt, config.bubbleTimeFormat ?? 'h:mm A')}</span>
  ) : null;

  // ── Debug overlays ──────────────────────────────────────────────────────
  const hasDebugChips = config.debugShowMessageId || config.debugShowTimestamps || config.debugShowRenderer;
  const hasDebug      = hasDebugChips || config.debugShowPayload;
  const debugChips = hasDebugChips ? (
    <div className="ce-debug-chips">
      {config.debugShowMessageId  && <DebugChip variant="id">id:{bubble.id.slice(0, 8)}</DebugChip>}
      {config.debugShowTimestamps && bubble.sentAt != null && <DebugChip variant="time">{fmtTime(bubble.sentAt)}</DebugChip>}
      {config.debugShowRenderer   && <DebugChip variant="renderer">renderer:{isError ? 'error' : (resolved?.key ?? '?')}</DebugChip>}
    </div>
  ) : null;
  const debugPayload = config.debugShowPayload ? (
    <div className="ce-debug-payload">
      <pre>{(() => { try { return JSON.stringify(JSON.parse(bubble.text), null, 2); } catch { return bubble.text ?? ''; } })()}</pre>
    </div>
  ) : null;

  return (
    <article
      className={[
        'ce-message',
        'ce-message--assistant',
        isError ? 'ce-message--error' : '',
        (hasTable || hideBubble) ? 'ce-message--wide' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hideBubble ? (
        // No bubble shell — the renderer component controls its own presentation.
        <div className="ce-message-row">
          <div
            className={[
              'ce-avatar',
              'ce-avatar--agent',
              isError ? 'ce-avatar--error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          >
            <AgentIcon />
          </div>
          <div className="ce-message-content ce-message-content--raw">
            <Renderer
              payload={resolved.payload}
              actions={actions}
              onSubmit={actions.submit}
            />
            {hasDebug && <>{debugChips}{debugPayload}</>}
          </div>
        </div>
      ) : (
        <div className="ce-message-row">
          <div
            className={[
              'ce-avatar',
              'ce-avatar--agent',
              isError ? 'ce-avatar--error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          >
            <AgentIcon />
            {isError && (
              <span className="ce-avatar-error-badge" aria-hidden="true">
                !
              </span>
            )}
          </div>
          <div className="ce-message-content">
            <div
              className={[
                'ce-bubble',
                'ce-bubble--agent',
                bubbleShapeClass(bubble.text),
                isError ? 'ce-bubble--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {!isError ? (
                // Pass the full `actions` object as the primary prop.
                // `onSubmit` kept as a convenience alias for simple renderers.
                <Renderer
                  payload={resolved.payload}
                  actions={actions}
                  onSubmit={actions.submit}
                />
              ) : (
                <pre className="ce-bubble-text ce-bubble-text--error">
                  <span className="ce-error-prefix" aria-hidden="true">
                    ⚠
                  </span>{' '}
                  {bubble.text}
                </pre>
              )}
            </div>
            {hasDebug && <>{debugChips}{debugPayload}</>}
          </div>
        </div>
      )}
      {timeCaption}
    </article>
  );
}

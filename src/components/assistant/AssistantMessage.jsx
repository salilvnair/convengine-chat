import { useIcons } from '../../hooks/useIcons.js';
import { bubbleShapeClass, isAssistantErrorBubble } from '../../utils/messageBubble.js';
import { containsMarkdownTable } from '../../utils/assistantContent.js';
import { resolveAssistantRenderer } from '../../renderers/core/RendererRegistry.jsx';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useChatActions } from '../../context/ChatActionsContext.jsx';

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

      {hideBubble ? (
        // No bubble shell — the renderer component controls its own presentation.
        <div className="ce-message-content ce-message-content--raw">
          <Renderer
            payload={resolved.payload}
            actions={actions}
            onSubmit={actions.submit}
          />
        </div>
      ) : (
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
        </div>
      )}
    </article>
  );
}

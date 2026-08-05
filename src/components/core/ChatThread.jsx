import { UserMessage } from '../user/UserMessage.jsx';
import { AssistantMessage } from '../assistant/AssistantMessage.jsx';
import { ChatFeedbackRow } from './ChatFeedbackRow.jsx';
import { ChatTypingIndicator } from './ChatTypingIndicator.jsx';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { Fragment } from 'react';
import { dayKey, formatDate } from '../../utils/dateFormat.js';

/**
 * Renders the scrollable list of conversation messages.
 * The feedback row is controlled by `config.showFeedback` (default: true).
 */
export function ChatThread({ threadRef, messages, isTyping, progressText, onFeedback, fullscreen = false }) {
  const { config } = useConvEngineChatContext();
  const showTyping = isTyping || config.debugShowVerbose;

  return (
    <div
      ref={threadRef}
      className={`ce-thread ${fullscreen ? 'ce-thread--fullscreen' : ''}`}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      {(() => {
        let lastDay = null;
        return messages.map((bubble) => {
          const isAssistant = bubble.role === 'assistant';
          const canShowFeedback = isAssistant && !bubble.text?.startsWith('Error:');
          const showFeedback = canShowFeedback && config.showFeedback;

          // Date separator chip
          const showSep = config.showDateSeparators && bubble.sentAt != null;
          const currentDay = showSep ? dayKey(bubble.sentAt) : null;
          const needsChip = showSep && currentDay !== lastDay;
          if (needsChip) lastDay = currentDay;

          return (
            <Fragment key={bubble.id}>
              {needsChip && (
                <div className="ce-date-separator" aria-hidden="true">
                  <span className={`ce-date-chip${config.dateSeparatorShape === 'rect' ? ' ce-date-chip--rect' : ''}`}>
                    {formatDate(bubble.sentAt, config.dateSeparatorFormat ?? 'auto')}
                  </span>
                </div>
              )}
              {bubble.role === 'user' ? (
                <UserMessage bubble={bubble} />
              ) : (
                // Bubble + feedback row share ONE hover surface (.ce-message-group)
                // spanning their full combined box — no dead zone between them, so
                // moving the mouse from the bubble down into the thumbs (or anywhere
                // else inside that box) never flickers the row hidden partway.
                <div className="ce-message-group">
                  <AssistantMessage bubble={bubble} />
                  {showFeedback && (
                    <ChatFeedbackRow bubble={bubble} onFeedback={onFeedback} />
                  )}
                </div>
              )}
            </Fragment>
          );
        });
      })()}

      {showTyping && <ChatTypingIndicator progressText={progressText} />}
    </div>
  );
}

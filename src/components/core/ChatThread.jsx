import { UserMessage } from '../user/UserMessage.jsx';
import { AssistantMessage } from '../assistant/AssistantMessage.jsx';
import { ChatFeedbackRow } from './ChatFeedbackRow.jsx';
import { ChatTypingIndicator } from './ChatTypingIndicator.jsx';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { Fragment } from 'react';

/**
 * Renders the scrollable list of conversation messages.
 * The feedback row is controlled by `config.showFeedback` (default: true).
 */
export function ChatThread({ threadRef, messages, isTyping, progressText, onFeedback, fullscreen = false }) {
  const { config } = useConvEngineChatContext();

  return (
    <div
      ref={threadRef}
      className={`ce-thread ${fullscreen ? 'ce-thread--fullscreen' : ''}`}
      role="log"
      aria-live="polite"
      aria-label="Conversation"
    >
      {messages.map((bubble) => {
        const isAssistant = bubble.role === 'assistant';
        const canShowFeedback = isAssistant && !bubble.text?.startsWith('Error:');
        const showFeedback = canShowFeedback && config.showFeedback;

        return (
          <Fragment key={bubble.id}>
            {bubble.role === 'user' ? (
              <UserMessage bubble={bubble} />
            ) : (
              <AssistantMessage bubble={bubble} />
            )}
            {showFeedback && (
              <ChatFeedbackRow bubble={bubble} onFeedback={onFeedback} />
            )}
          </Fragment>
        );
      })}

      {isTyping && <ChatTypingIndicator progressText={progressText} />}
    </div>
  );
}

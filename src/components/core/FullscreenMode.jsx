import { useState, useMemo } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatArea } from '../core/ChatArea.jsx';
import { NewChatIcon } from '../../icons/Icons.jsx';

/**
 * Fullscreen / inline mode — no panel chrome, fills parent container.
 * Shows an audit status strip at top when a response has been received.
 */
export function FullscreenMode({ isDark, toggleTheme }) {
  const { config } = useConvEngineChatContext();

  const {
    messages,
    input,
    setInput,
    isTyping,
    progressText,
    auditRevision,
    engineStatus,
    isInitial,
    isMultiLine,
    threadRef,
    inputRef,
    sendMessage,
    submitFromRenderer,
    submitSilent,
    appendBubble,
    prefillInput,
    resetChat,
    handleKeyDown,
    submitFeedback,
  } = useChat();

  const chatActions = useMemo(
    () => ({
      actions: {
        submit:       submitFromRenderer,
        submitSilent,
        appendBubble,
        prefillInput,
      },
    }),
    [submitFromRenderer, submitSilent, appendBubble, prefillInput],
  );

  return (
    <ChatActionsContext.Provider value={chatActions}>
      <div className="ce-fullscreen">
        <button
          type="button"
          className="ce-fullscreen-new-chat"
          title="New chat"
          aria-label="Start new chat"
          onClick={resetChat}
        >
          <NewChatIcon />
          New chat
        </button>
        <ChatArea
          variant="fullscreen"
          isInitial={isInitial}
          input={input}
          isTyping={isTyping}
          isMultiLine={isMultiLine}
          inputRef={inputRef}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onSend={sendMessage}
          threadRef={threadRef}
          messages={messages}
          progressText={progressText}
          onFeedback={submitFeedback}
          auditRevision={auditRevision}
          auditOpen={false}
          engineStatus={engineStatus}
        />
      </div>
    </ChatActionsContext.Provider>
  );
}

import { ChatComposer } from './ChatComposer.jsx';

/**
 * Initial landing screen shown before the first message is sent.
 */
export function ChatLanding({
  fullscreen = false,
  title = 'How can I help you today?',
  input,
  isTyping,
  isMultiLine,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  placeholder,
}) {
  return (
    <div className={`ce-landing ${fullscreen ? 'ce-landing--fullscreen' : ''}`}>
      <div className="ce-landing-hero">
        {!fullscreen && (
          <div className="ce-landing-avatar" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="currentColor" opacity="0.12" />
              <path
                d="M12 14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-6z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path d="M20 10v2M17 22v5M23 22v5M13 26l4-2M23 24l4 2M17 28h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="17" cy="17" r="1" fill="currentColor" />
              <circle cx="23" cy="17" r="1" fill="currentColor" />
            </svg>
          </div>
        )}
        <h2 className="ce-landing-title">{title}</h2>
        {!fullscreen && (
          <p className="ce-landing-subtitle">Ask me anything — I&apos;ll do my best to help.</p>
        )}
      </div>

      <ChatComposer
        centered
        fullscreen={fullscreen}
        inputRef={inputRef}
        input={input}
        isTyping={isTyping}
        isMultiLine={isMultiLine}
        onInputChange={onInputChange}
        onKeyDown={onKeyDown}
        onSend={onSend}
        placeholder={placeholder}
      />
    </div>
  );
}

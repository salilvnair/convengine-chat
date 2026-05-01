import { ChatComposer } from './ChatComposer.jsx';
import { useIcons } from '../../hooks/useIcons.js';

/**
 * Initial landing screen shown before the first message is sent.
 */
export function ChatLanding({
  fullscreen = false,
  hideComposer = false,
  title = 'ConvEngine Assistant',
  subtitle = "Ask me anything — I'll do my best to help.",
  showAvatar = true,
  showSubtitle = true,
  input,
  isTyping,
  isMultiLine,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  placeholder, shape,
}) {
  const { LandingAvatarIcon } = useIcons();
  return (
    <div className={`ce-landing ${fullscreen ? 'ce-landing--fullscreen' : ''}`}>
      <div className="ce-landing-hero">
        {showAvatar && (
          <div className="ce-landing-avatar" aria-hidden="true">
            <LandingAvatarIcon style={{ width: '100%', height: '100%' }} />
          </div>
        )}
        <h2 className="ce-landing-title">{title}</h2>
        {showSubtitle && (
          <p className="ce-landing-subtitle">{subtitle}</p>
        )}
      </div>

      {!hideComposer && (
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
          shape={shape}
        />
      )}
    </div>
  );
}

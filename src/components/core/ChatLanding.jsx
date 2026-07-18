import { ChatComposer } from './ChatComposer.jsx';
import { LandingChips } from './LandingChips.jsx';
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
  placeholder,
  shape,
  reply = null,
  // Landing chips
  chips,
  chipsOrientation,
  chipsShape,
  chipsAnchor    = 'landingAgent',  // 'landingAgent' | 'chatbox'
  anchorPadding,                     // number (px) or CSS string — controls gap
  onChipClick,
}) {
  const { LandingAvatarIcon } = useIcons();
  const atChatbox = chipsAnchor === 'chatbox';
  const hasChips  = chips && chips.length > 0;

  // Inject --ce-chip-anchor-padding when consumer overrides the default.
  // Accepts: number (8), numeric string ("8"), or CSS value ("8px", "0.5rem").
  // Bare numbers/numeric strings always get 'px' so calc() stays valid.
  const toCssLength = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n}px` : String(v);
  };
  const anchorStyle = anchorPadding != null
    ? { '--ce-chip-anchor-padding': toCssLength(anchorPadding) }
    : {};

  const chipsEl = hasChips ? (
    <LandingChips
      chips={chips}
      orientation={chipsOrientation}
      shape={chipsShape}
      onChipClick={onChipClick}
    />
  ) : null;

  const composerEl = !hideComposer ? (
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
      reply={reply}
    />
  ) : null;

  return (
    <div
      className={[
        'ce-landing',
        fullscreen  ? 'ce-landing--fullscreen'       : '',
        atChatbox   ? 'ce-landing--chips-at-chatbox' : '',
      ].filter(Boolean).join(' ')}
      style={anchorStyle}
    >
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

      {/* landingAgent anchor: chips sit between hero and composer */}
      {!atChatbox && chipsEl}

      {atChatbox ? (
        /* chatbox anchor: chips + composer pinned to bottom in a footer.
           In fullscreen, hideComposer=true so chips render alone.       */
        hideComposer ? chipsEl : (
          <div className="ce-landing-footer">
            {chipsEl}
            {composerEl}
          </div>
        )
      ) : (
        composerEl
      )}
    </div>
  );
}

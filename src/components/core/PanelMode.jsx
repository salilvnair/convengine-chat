import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatHeader } from '../core/ChatHeader.jsx';
import { ChatArea } from '../core/ChatArea.jsx';
import { ChatBubbleIcon, CloseIcon, MinimizeIcon, MaximizeIcon, RestoreIcon, LayoutIcon } from '../../icons/Icons.jsx';

/**
 * Panel mode — a floating FAB button that opens a chat panel anchored to a
 * corner of the viewport.
 *
 * Props:
 *   position  "bottom" | "top"    (default: "bottom")
 *   align     "right"  | "left"   (default: "right")
 */
export function PanelMode({ position = 'bottom', align = 'right', isDark, toggleTheme, onModeChange }) {
  const { config } = useConvEngineChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef(null);

  // Close mode menu when clicking outside
  useEffect(() => {
    if (!modeMenuOpen) return;
    function handleClick(e) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target)) {
        setModeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [modeMenuOpen]);

  const {
    messages,
    input,
    setInput,
    isTyping,
    progressText,
    auditRevision,
    isInitial,
    isMultiLine,
    threadRef,
    inputRef,
    sendMessage,
    submitFromRenderer,
    submitSilent,
    appendBubble,
    prefillInput,
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

  // Position modifier classes
  const posClass = position === 'top' ? 'ce-panel--top' : 'ce-panel--bottom';
  const alignClass = align === 'left' ? 'ce-panel--left' : 'ce-panel--right';
  const fabAlignClass = align === 'left' ? 'ce-fab--left' : 'ce-fab--right';
  const fabPosClass = position === 'top' ? 'ce-fab--top' : 'ce-fab--bottom';

  const panelStateClass = isOpen
    ? isMinimized
      ? 'ce-panel--minimized'
      : isMaximized
        ? 'ce-panel--open ce-panel--maximized'
        : 'ce-panel--open'
    : 'ce-panel--closed';

  const modeOptions = [
    { id: 'sidepanel-left',  label: '← Left Side',   icon: '◁' },
    { id: 'sidepanel-right', label: 'Right Side →',  icon: '▷' },
  ];

  const headerActions = (
    <>
      {/* Mode picker */}
      {onModeChange && (
        <div ref={modeMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className={`ce-header-btn ${modeMenuOpen ? 'ce-header-btn--active' : ''}`}
            title="Switch chat view"
            aria-label="Switch chat view"
            aria-haspopup="true"
            aria-expanded={modeMenuOpen}
            onClick={() => setModeMenuOpen((v) => !v)}
          >
            <LayoutIcon />
          </button>
          {modeMenuOpen && (
            <div className="ce-mode-menu" role="menu">
              {modeOptions.map((opt) => (
                <button
                  key={opt.id}
                  role="menuitem"
                  className="ce-mode-menu-item"
                  onClick={() => {
                    setModeMenuOpen(false);
                    onModeChange(opt.id);
                  }}
                >
                  <span className="ce-mode-menu-icon">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className="ce-header-btn"
        title={isMaximized ? 'Restore size' : 'Maximize'}
        aria-label={isMaximized ? 'Restore chat size' : 'Maximize chat'}
        onClick={() => { setIsMaximized((v) => !v); setIsMinimized(false); }}
      >
        {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className="ce-header-btn"
        title={isMinimized ? 'Restore' : 'Minimize'}
        aria-label={isMinimized ? 'Restore chat' : 'Minimize chat'}
        onClick={() => { setIsMinimized((v) => !v); setIsMaximized(false); }}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="ce-header-btn ce-header-btn--close"
        title="Close chat"
        aria-label="Close chat"
        onClick={() => { setIsOpen(false); setIsMinimized(false); setIsMaximized(false); }}
      >
        <CloseIcon />
      </button>
    </>
  );

  return (
    <ChatActionsContext.Provider value={chatActions}>
    <>
      {/* ── Floating chat panel ──────────────────────────────────── */}
      <div
        className={`ce-panel ${posClass} ${alignClass} ${panelStateClass}`}
        role="dialog"
        aria-modal="false"
        aria-label="Chat panel"
        aria-hidden={!isOpen}
      >
        <ChatHeader
          title={config.title}
          showDarkModeLightMode={config.showDarkModeLightMode}
          showAudit={config.showAudit}
          isDark={isDark}
          auditOpen={auditOpen}
          onToggleTheme={toggleTheme}
          onToggleAudit={() => setAuditOpen((v) => !v)}
          actions={headerActions}
        />

        {!isMinimized && (
          <ChatArea
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
            auditOpen={auditOpen}
          />
        )}
      </div>

      {/* ── FAB launcher button ────────────────────────────────────────── */}
      <button
        type="button"
        className={`ce-fab ${fabPosClass} ${fabAlignClass} ${isOpen ? 'ce-fab--active' : ''}`}
        title={isOpen ? 'Close chat' : 'Open chat'}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-expanded={isOpen}
        aria-controls="ce-chat-panel"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setIsMinimized(false);
            setIsMaximized(false);
          } else {
            setIsOpen(true);
            setIsMinimized(false);
          }
        }}
      >
        <span className={`ce-fab-icon ce-fab-icon--chat ${isOpen ? 'ce-fab-icon--hidden' : ''}`}>
          <ChatBubbleIcon />
        </span>
        <span className={`ce-fab-icon ce-fab-icon--close ${!isOpen ? 'ce-fab-icon--hidden' : ''}`}>
          <CloseIcon />
        </span>
      </button>
    </>
    </ChatActionsContext.Provider>
  );
}

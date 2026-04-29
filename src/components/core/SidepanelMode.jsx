import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatHeader } from '../core/ChatHeader.jsx';
import { ChatArea } from '../core/ChatArea.jsx';
import { ChatBubbleIcon, CloseIcon, LayoutIcon } from '../../icons/Icons.jsx';

/**
 * Sidepanel mode — a full-height drawer anchored to the left or right edge.
 * A narrow tab on the edge toggles it open/closed.
 *
 * Props:
 *   align  "right" | "left"  (default: "right")
 */
export function SidepanelMode({ align = 'right', isDark, toggleTheme, onModeChange }) {
  const { config } = useConvEngineChatContext();
  const [isOpen, setIsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef(null);

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

  const modeOptions = [
    { id: 'panel',           label: 'Panel (FAB)',   icon: '⊞' },
    { id: 'sidepanel-left',  label: '← Left Side',   icon: '◁' },
    { id: 'sidepanel-right', label: 'Right Side →',  icon: '▷' },
  ];

  const headerActions = (
    <>
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
        className="ce-header-btn ce-header-btn--close"
        title="Close chat"
        aria-label="Close chat"
        onClick={() => setIsOpen(false)}
      >
        <CloseIcon />
      </button>
    </>
  );

  return (
    <ChatActionsContext.Provider value={chatActions}>
      <>
        {/* ── FAB button (same as panel mode) ──────────────────────── */}
        {!isOpen && (
          <button
            type="button"
            className={`ce-fab ce-fab--bottom ce-fab--${align}`}
            title="Open chat"
            aria-label="Open chat"
            aria-haspopup="dialog"
            onClick={() => setIsOpen(true)}
          >
            <ChatBubbleIcon />
          </button>
        )}

        {/* ── Side drawer ──────────────────────────────────────────── */}
        <div
          className={`ce-sidepanel ce-sidepanel--${align} ${isOpen ? 'ce-sidepanel--open' : 'ce-sidepanel--closed'}`}
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
        </div>
      </>
    </ChatActionsContext.Provider>
  );
}

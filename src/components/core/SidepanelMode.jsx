import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatHeader } from '../core/ChatHeader.jsx';
import { ChatArea } from '../core/ChatArea.jsx';

/**
 * Sidepanel mode — a full-height drawer anchored to the left or right edge.
 * A narrow tab on the edge toggles it open/closed.
 *
 * Props:
 *   align  "right" | "left"  (default: "right")
 */
export function SidepanelMode({ align = 'right', isDark, toggleTheme, onModeChange, initialOpen = false }) {
  const { config } = useConvEngineChatContext();
  const {
    AuditIcon, ChatBubbleIcon, CloseIcon, LayoutIcon, NewChatIcon, PanelLeftIcon, PanelRightIcon,
  } = useIcons();
  const [isOpen,         setIsOpen]         = useState(initialOpen);
  const [auditOpen,      setAuditOpen]      = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const [modeMenuOpen,   setModeMenuOpen]   = useState(false);
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

  // ── New chat with confirmation ────────────────────────────────────────────
  const handleNewChat = () => {
    if (messages.length > 0) setConfirmNewChat(true);
    else resetChat();
  };

  const currentModeId = align === 'left' ? 'sidepanel-left' : 'sidepanel-right';
  const modeOptions = [
    { id: 'panel',           label: 'Panel (FAB)', Icon: LayoutIcon     },
    { id: 'sidepanel-left',  label: 'Left Side',   Icon: PanelLeftIcon  },
    { id: 'sidepanel-right', label: 'Right Side',  Icon: PanelRightIcon },
  ].filter((opt) => opt.id !== currentModeId);

  const headerActions = (
    <>
      {/* New Chat */}
      <button
        type="button"
        className="ce-header-btn"
        title="New chat"
        aria-label="Start new chat"
        onClick={handleNewChat}
      >
        <NewChatIcon />
      </button>

      {/* Audit toggle — only shown when showAudit is enabled */}
      {config.showAudit && (
        <button
          type="button"
          className={`ce-header-btn ${auditOpen ? 'ce-header-btn--active' : ''}`}
          title={auditOpen ? 'Hide audit trail' : 'Show audit trail'}
          aria-label={auditOpen ? 'Hide audit trail' : 'Show audit trail'}
          aria-pressed={auditOpen}
          onClick={() => setAuditOpen((v) => !v)}
        >
          <AuditIcon />
        </button>
      )}

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
                  <opt.Icon style={{ width: 15, height: 15, marginRight: 6 }} />
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
        {/* ── FAB button (shown when drawer is closed) ──────────────────── */}
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

        {/* ── Side drawer ───────────────────────────────────────────────── */}
        <div
          className={`ce-sidepanel ce-sidepanel--${align} ${isOpen ? 'ce-sidepanel--open' : 'ce-sidepanel--closed'}`}
          role="dialog"
          aria-modal="false"
          aria-label="Chat panel"
          aria-hidden={!isOpen}
        >
          {/* ── Confirm new-chat dialog — overlays only the sidepanel */}
          {confirmNewChat && (
            <div
              className="ce-confirm-overlay"
              style={{ position: 'absolute', inset: 0, zIndex: 10 }}
            >
              <div className="ce-confirm-dialog">
                <p className="ce-confirm-msg">Start a new chat? Your current conversation will be cleared.</p>
                <div className="ce-confirm-btns">
                  <button className="ce-confirm-cancel" onClick={() => setConfirmNewChat(false)}>Cancel</button>
                  <button className="ce-confirm-ok" onClick={() => { resetChat(); setConfirmNewChat(false); }}>New Chat</button>
                </div>
              </div>
            </div>
          )}

          <ChatHeader
            title={config.title}
            showDarkModeLightMode={config.showDarkModeLightMode}
            showAudit={false}
            showHeaderDot={config.showHeaderDot}
            isDark={isDark}
            onToggleTheme={toggleTheme}
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
            onCloseAudit={() => setAuditOpen(false)}
          />
        </div>
      </>
    </ChatActionsContext.Provider>
  );
}

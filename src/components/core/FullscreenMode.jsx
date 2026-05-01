import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatArea } from '../core/ChatArea.jsx';
import { AuditPanel } from '../core/AuditPanel.jsx';

const DEFAULT_AUDIT_WIDTH = 320;
const MIN_AUDIT_WIDTH     = 220;
const MAX_AUDIT_RATIO     = 0.55;

/**
 * Fullscreen / inline mode — no panel chrome, fills parent container.
 * Header bar at top with new-chat + audit toggle + optional dark-mode toggle.
 * Audit panel slides in from the right with a draggable divider.
 */
export function FullscreenMode({ isDark, toggleTheme, actionsRef = null }) {
  const { config } = useConvEngineChatContext();
  const { AuditIcon, SunIcon, MoonIcon, NewChatIcon } = useIcons();
  const [auditOpen,      setAuditOpen]      = useState(false);
  const [auditWidth,     setAuditWidth]     = useState(DEFAULT_AUDIT_WIDTH);
  const [auditResizing,  setAuditResizing]  = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const auditResizingRef = useRef(false);

  // ── Audit resize drag ─────────────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!auditResizingRef.current) return;
      const maxW = Math.floor(window.innerWidth * MAX_AUDIT_RATIO);
      const next = Math.min(Math.max(window.innerWidth - e.clientX, MIN_AUDIT_WIDTH), maxW);
      setAuditWidth(next);
    };
    const stopResize = () => {
      if (!auditResizingRef.current) return;
      auditResizingRef.current = false;
      setAuditResizing(false);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   stopResize);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   stopResize);
    };
  }, []);

  const onResizeMouseDown = () => {
    auditResizingRef.current = true;
    setAuditResizing(true);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  };

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

  // Expose chat actions to external consumers via actionsRef
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = { submit: submitFromRenderer, submitSilent, appendBubble, prefillInput, reset: resetChat };
    return () => { if (actionsRef) actionsRef.current = null; };
  });

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

  const handleNewChat = () => {
    if (messages.length > 0) setConfirmNewChat(true);
    else resetChat();
  };

  return (
    <ChatActionsContext.Provider value={chatActions}>
      <div className="ce-fullscreen">

        {/* ── Confirm new-chat dialog ─────────────────────────────────── */}
        {confirmNewChat && (
          <div className="ce-confirm-overlay" style={{ position: 'absolute', inset: 0, zIndex: 99 }}>
            <div className="ce-confirm-dialog">
              <p className="ce-confirm-msg">Start a new chat? Your current conversation will be cleared.</p>
              <div className="ce-confirm-btns">
                <button className="ce-confirm-cancel" onClick={() => setConfirmNewChat(false)}>Cancel</button>
                <button className="ce-confirm-ok" onClick={() => { resetChat(); setConfirmNewChat(false); }}>New Chat</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Header bar ──────────────────────────────────────────────── */}
        <div className="ce-fullscreen-header">
          <div className="ce-header-brand">
            {config.showHeaderDot && <span className="ce-header-dot" aria-hidden="true" />}
            <span className="ce-header-title">{config.title}</span>
          </div>
          <div className="ce-fullscreen-header-actions">
            {config.showNewChat && (
              <button
                type="button"
                className="ce-header-btn"
                title="New chat"
                aria-label="Start new chat"
                onClick={handleNewChat}
              >
                <NewChatIcon />
              </button>
            )}
            {config.showDarkModeLightMode && (
              <button
                type="button"
                className="ce-header-btn"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
            )}
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
          </div>
        </div>

        {/* ── Body: chat area — full width; audit overlays absolutely ────── */}
        <div className={`ce-fullscreen-body${auditResizing ? ' ce-fullscreen-body--resizing' : ''}`}>
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

        {/* ── Audit overlay — absolutely covers full container height ─────── */}
        {auditOpen && config.showAudit && (
          <>
            <div
              className="ce-audit-resize-handle"
              style={{ right: auditWidth }}
              onMouseDown={onResizeMouseDown}
              title="Drag to resize audit panel"
            />
            <div className="ce-audit-panel-wrapper" style={{ width: auditWidth }}>
              <AuditPanel auditRevision={auditRevision} onClose={() => setAuditOpen(false)} />
            </div>
          </>
        )}

      </div>
    </ChatActionsContext.Provider>
  );
}

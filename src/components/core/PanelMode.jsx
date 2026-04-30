import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatHeader } from '../core/ChatHeader.jsx';
import { ChatArea } from '../core/ChatArea.jsx';

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
  const {
    ChatBubbleIcon, CloseIcon, MinimizeIcon,
    MaximizeIcon, RestoreIcon, RestoreFromMinIcon,
    LayoutIcon, NewChatIcon, PanelLeftIcon, PanelRightIcon,
  } = useIcons();
  const [isOpen,          setIsOpen]          = useState(false);
  const [isMinimized,     setIsMinimized]     = useState(false);
  const [isPopout,        setIsPopout]        = useState(false);
  const [popoutPos,       setPopoutPos]       = useState({ x: null, y: null });
  // track which mode to restore to after un-minimizing
  const [lastMode,        setLastMode]        = useState('fab');   // 'fab' | 'popout'
  const [confirmNewChat,  setConfirmNewChat]  = useState(false);
  const [modeMenuOpen,    setModeMenuOpen]    = useState(false);
  const modeMenuRef = useRef(null);
  const dragRef     = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  // Close mode menu on outside click
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

  // ── CSS position classes ──────────────────────────────────────────────────
  const posClass      = position === 'top'  ? 'ce-panel--top'    : 'ce-panel--bottom';
  const alignClass    = align    === 'left' ? 'ce-panel--left'   : 'ce-panel--right';
  const fabAlignClass = align    === 'left' ? 'ce-fab--left'     : 'ce-fab--right';
  const fabPosClass   = position === 'top'  ? 'ce-fab--top'      : 'ce-fab--bottom';

  const panelStateClass = isOpen
    ? isMinimized
      ? 'ce-panel--minimized'
      : isPopout
        ? 'ce-panel--open ce-panel--popout'
        : 'ce-panel--open'
    : 'ce-panel--closed';

  // Popout overrides corner anchor with absolute drag position
  const popoutStyle = (isPopout && !isMinimized && popoutPos.x !== null)
    ? { position: 'fixed', left: popoutPos.x, top: popoutPos.y, right: 'auto', bottom: 'auto', transform: 'none' }
    : {};

  // ── Drag-to-move in popout mode (via header brand area) ──────────────────
  const onTitleDragStart = (e) => {
    if (!isPopout || isMinimized) return;
    e.preventDefault();
    const panel = e.currentTarget.closest('.ce-panel');
    const rect  = panel?.getBoundingClientRect?.();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX:  popoutPos.x ?? rect?.left ?? 200,
      origY:  popoutPos.y ?? rect?.top  ?? 100,
    };
    function onMove(ev) {
      if (!dragRef.current.active) return;
      setPopoutPos({
        x: dragRef.current.origX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.origY + ev.clientY - dragRef.current.startY,
      });
    }
    function onUp() {
      dragRef.current.active = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  // ── New chat with confirmation if messages exist ──────────────────────────
  const handleNewChat = () => {
    if (messages.length > 0) setConfirmNewChat(true);
    else resetChat();
  };

  // ── Mode picker options ───────────────────────────────────────────────────
  const modeOptions = [
    { id: 'sidepanel-left',  label: 'Left Side',  Icon: PanelLeftIcon  },
    { id: 'sidepanel-right', label: 'Right Side', Icon: PanelRightIcon },
  ];

  // ── Header action buttons ─────────────────────────────────────────────────
  const headerActions = (
    <>
      {/* New Chat */}
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

      {/* Mode picker */}
      {config.showLayoutPicker && onModeChange && (
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
                  onClick={() => { setModeMenuOpen(false); onModeChange(opt.id); }}
                >
                  <opt.Icon style={{ width: 15, height: 15, marginRight: 6 }} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Maximize / Restore — pops panel to center, draggable */}
      {config.showMaximize && (
        <button
          type="button"
          className={`ce-header-btn ${isPopout ? 'ce-header-btn--active' : ''}`}
          title={isPopout ? 'Restore to corner' : 'Expand to centre'}
          aria-label={isPopout ? 'Restore panel to corner' : 'Expand panel to centre'}
          onClick={() => {
            const next = !isPopout;
            if (next && popoutPos.x === null) {
              setPopoutPos({
                x: Math.round((window.innerWidth  - 500) / 2),
                y: Math.round((window.innerHeight - 640) / 2),
              });
            }
            setIsPopout(next);
            setLastMode(next ? 'popout' : 'fab');
            setIsMinimized(false);
          }}
        >
          {isPopout ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
      )}

      {/* Minimize / Restore — icon changes based on state */}
      {config.showMinimize && (
        <button
          type="button"
          className="ce-header-btn"
          title={isMinimized ? 'Restore' : 'Minimize'}
          aria-label={isMinimized ? 'Restore chat' : 'Minimize chat'}
          onClick={() => {
            if (isMinimized) {
              setIsMinimized(false);
              setIsPopout(lastMode === 'popout');
            } else {
              setLastMode(isPopout ? 'popout' : 'fab');
              setIsMinimized(true);
              setIsPopout(false);
            }
          }}
        >
          {isMinimized ? <RestoreFromMinIcon /> : <MinimizeIcon />}
        </button>
      )}

      <button
        type="button"
        className="ce-header-btn ce-header-btn--close"
        title="Close chat"
        aria-label="Close chat"
        onClick={() => { setIsOpen(false); setIsMinimized(false); setIsPopout(false); }}
      >
        <CloseIcon />
      </button>
    </>
  );

  return (
    <ChatActionsContext.Provider value={chatActions}>
    <>
      {/* ── Floating chat panel ───────────────────────────────────────────── */}
      <div
        className={`ce-panel ${posClass} ${alignClass} ${panelStateClass}`}
        style={popoutStyle}
        role="dialog"
        aria-modal="false"
        aria-label="Chat panel"
        aria-hidden={!isOpen}
      >
        {/* ── Confirm new-chat dialog — overlays only the panel */}
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
          onDragStart={onTitleDragStart}
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
            auditOpen={false}
          />
        )}
      </div>  {/* end ce-panel */}

      {/* ── FAB launcher button ───────────────────────────────────────────── */}
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
            setIsPopout(false);
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

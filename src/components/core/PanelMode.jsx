import { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat.js';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';
import { ChatActionsContext } from '../../context/ChatActionsContext.jsx';
import { ChatHeader } from '../core/ChatHeader.jsx';
import { ChatArea } from '../core/ChatArea.jsx';
import { hasFullscreenTab, openFullscreenTab } from '../../utils/fullscreenTab.js';
import { resolveOrbAnimation, dragTransform } from '../../utils/orbAnimations.js';

/**
 * Panel mode — a floating FAB button that opens a chat panel anchored to a
 * corner of the viewport.
 *
 * Props:
 *   position  "bottom" | "top"    (default: "bottom")
 *   align     "right"  | "left"   (default: "right")
 */
export function PanelMode({ position = 'bottom', align = 'right', draggable = false, isDark, toggleTheme, onModeChange, initialOpen = false, actionsRef = null, subHeader = null, open, onOpenChange }) {
  const { config } = useConvEngineChatContext();
  // Controlled vs uncontrolled open: when `open` is provided, the consumer owns
  // the open state (e.g. drives it from its own launcher) — otherwise the FAB
  // toggles an internal state. `config.showFab: false` hides the built-in FAB
  // for consumers that provide their own trigger.
  const isOpenControlled = open !== undefined;
  const {
    ChatBubbleIcon, CloseIcon, MinimizeIcon,
    MaximizeIcon, RestoreIcon, RestoreFromMinIcon,
    LayoutIcon, NewChatIcon, PanelLeftIcon, PanelRightIcon, PopoutIcon,
  } = useIcons();
  const [internalOpen,    setInternalOpen]    = useState(initialOpen);
  const isOpen  = isOpenControlled ? open : internalOpen;
  const setIsOpen = (v) => { if (isOpenControlled) onOpenChange?.(v); else setInternalOpen(v); };
  const [isMinimized,     setIsMinimized]     = useState(false);
  const [isPopout,        setIsPopout]        = useState(false);
  const [popoutPos,       setPopoutPos]       = useState({ x: null, y: null });
  // Popout size — null until the user actually drags a resize handle, so the
  // panel keeps its normal CSS-driven (content-hugging) size by default and
  // only becomes a fixed-size "window" once resized, like a real OS window.
  const [popoutSize,      setPopoutSize]      = useState({ width: null, height: null });
  const [isInteracting,   setIsInteracting]   = useState(false); // dragging OR resizing — disables the panel's CSS transition
  // track which mode to restore to after un-minimizing
  const [lastMode,        setLastMode]        = useState('fab');   // 'fab' | 'popout'
  const [confirmNewChat,  setConfirmNewChat]  = useState(false);
  const [modeMenuOpen,    setModeMenuOpen]    = useState(false);
  const modeMenuRef = useRef(null);
  const panelRef     = useRef(null);
  const dragRef     = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const resizeRef   = useRef({ active: false, edge: null, startX: 0, startY: 0, startW: 0, startH: 0, startLeft: 0, startTop: 0 });

  const POPOUT_MIN_WIDTH  = 320;
  const POPOUT_MIN_HEIGHT = 400; // matches the base --ce-panel-min-height default
  const popoutClamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // ── Draggable orb (movable FAB) ───────────────────────────────────────────
  const orbMovement        = config.orbMovement        ?? 'edgeSnap'; // 'edgeSnap' | 'freeform'
  const orbAnim            = resolveOrbAnimation(config.orbAnimation ?? 'bubblegum');
  const persistOrbPosition = config.persistOrbPosition ?? true;
  const orbStorageKey      = config.orbStorageKey      ?? 'ce-chat-orb-pos';
  const fabRef        = useRef(null);
  const [orbPos,       setOrbPos]       = useState(null); // { x, y } fixed-position px, once dragged/loaded
  const [orbDragging,  setOrbDragging]  = useState(false);
  const [orbSquish,    setOrbSquish]    = useState({ x: 0, y: 0 });
  const orbDragRef = useRef({ active: false, dragged: false, startX: 0, startY: 0, origX: 0, origY: 0, lastX: 0, lastY: 0, lastT: 0 });
  const ORB_MARGIN = 16;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // Seed the orb's starting position: restore from localStorage, else measure
  // the CSS-anchored corner position so the first paint matches the static
  // (non-draggable) FAB exactly — no flash/jump.
  useEffect(() => {
    if (!draggable) return;
    let seeded = false;
    if (persistOrbPosition) {
      try {
        const raw = localStorage.getItem(orbStorageKey);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && fabRef.current) {
            const fs = fabRef.current.offsetWidth || 52;
            setOrbPos({
              x: clamp(saved.x, ORB_MARGIN, window.innerWidth  - fs - ORB_MARGIN),
              y: clamp(saved.y, ORB_MARGIN, window.innerHeight - fs - ORB_MARGIN),
            });
            seeded = true;
          }
        }
      } catch { /* ignore corrupt/unavailable storage */ }
    }
    if (!seeded && fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect();
      setOrbPos({ x: rect.left, y: rect.top });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  // Keep the orb on-screen if the viewport resizes.
  useEffect(() => {
    if (!draggable) return;
    function handleResize() {
      setOrbPos((pos) => {
        if (!pos || !fabRef.current) return pos;
        const fs = fabRef.current.offsetWidth || 52;
        return {
          x: clamp(pos.x, ORB_MARGIN, window.innerWidth  - fs - ORB_MARGIN),
          y: clamp(pos.y, ORB_MARGIN, window.innerHeight - fs - ORB_MARGIN),
        };
      });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draggable]);

  function persistOrbPos(pos) {
    if (!persistOrbPosition) return;
    try { localStorage.setItem(orbStorageKey, JSON.stringify(pos)); } catch { /* ignore */ }
  }

  function handleOrbPointerDown(e) {
    if (!draggable || !fabRef.current) return;
    const rect = fabRef.current.getBoundingClientRect();
    orbDragRef.current = {
      active: true, dragged: false,
      startX: e.clientX, startY: e.clientY,
      origX: rect.left,  origY: rect.top,
      lastX: e.clientX,  lastY: e.clientY, lastT: performance.now(),
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handleOrbPointerMove(e) {
    const d = orbDragRef.current;
    if (!d.active || !fabRef.current) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.dragged && Math.hypot(dx, dy) > 4) {
      d.dragged = true;
      setOrbDragging(true);
    }
    if (!d.dragged) return;

    const fs = fabRef.current.offsetWidth || 52;
    const nx = clamp(d.origX + dx, ORB_MARGIN, window.innerWidth  - fs - ORB_MARGIN);
    const ny = clamp(d.origY + dy, ORB_MARGIN, window.innerHeight - fs - ORB_MARGIN);
    setOrbPos({ x: nx, y: ny });

    if (orbAnim.squish > 0 || orbAnim.rotateSquish) {
      const now = performance.now();
      const dt  = Math.max(now - d.lastT, 1);
      const vx  = (e.clientX - d.lastX) / dt;
      const vy  = (e.clientY - d.lastY) / dt;
      d.lastX = e.clientX; d.lastY = e.clientY; d.lastT = now;
      setOrbSquish({ x: clamp(vx * 18, -12, 12), y: clamp(vy * 18, -12, 12) });
    }
  }

  // Plays the preset's one-shot "settle" keyframe (bounce/wobble/pop) once
  // the orb lands. Applied imperatively via a reflow restart so it replays
  // identically on every drop, then cleared so React's own styles (hover,
  // active, etc.) stay in control afterwards.
  function triggerSettle() {
    const el = fabRef.current;
    const kf = orbAnim.settleKeyframe;
    if (!el || !kf) return;
    el.style.animation = 'none';
    void el.offsetWidth; // force reflow so the animation restarts from scratch
    el.style.animation = `${kf.name} ${kf.duration}ms ease`;
    window.setTimeout(() => { if (el) el.style.animation = ''; }, kf.duration + 50);
  }

  function handleOrbPointerUp() {
    const d = orbDragRef.current;
    if (!d.active) return;
    d.active = false;
    setOrbDragging(false);
    setOrbSquish({ x: 0, y: 0 });
    if (d.dragged && fabRef.current) {
      const fs = fabRef.current.offsetWidth || 52;
      setOrbPos((pos) => {
        if (!pos) return pos;
        const next = orbMovement === 'freeform'
          ? pos
          : { x: (pos.x + fs / 2 < window.innerWidth / 2) ? ORB_MARGIN : window.innerWidth - fs - ORB_MARGIN, y: pos.y };
        persistOrbPos(next);
        return next;
      });
      triggerSettle();
    }
  }

  // A drag that actually moved the orb should not also toggle the panel open.
  function handleOrbClick(e) {
    if (orbDragRef.current.dragged) {
      orbDragRef.current.dragged = false;
      e.preventDefault();
      return;
    }
    if (isOpen) {
      setIsOpen(false);
      setIsMinimized(false);
      setIsPopout(false);
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  }

  const orbFabStyle = (draggable && orbPos) ? {
    left: orbPos.x, top: orbPos.y, right: 'auto', bottom: 'auto',
    transition: orbDragging || orbAnim.dropDuration === 0
      ? 'none'
      : `left ${orbAnim.dropDuration}ms ${orbAnim.dropEasing}, top ${orbAnim.dropDuration}ms ${orbAnim.dropEasing}`,
    ...(orbDragging ? { transform: dragTransform(orbAnim, orbSquish) } : {}),
  } : undefined;

  // Panel re-anchors next to the orb's current position instead of the
  // static corner classes, once the orb has been placed somewhere.
  const orbPanelStyle = useMemo(() => {
    if (!draggable || !orbPos || typeof window === 'undefined') return {};
    const fs = fabRef.current?.offsetWidth ?? 52;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const style = { position: 'fixed' };
    const onLeft = (orbPos.x + fs / 2) < vw / 2;
    if (onLeft) style.left = Math.max(ORB_MARGIN, orbPos.x);
    else        style.right = Math.max(ORB_MARGIN, vw - (orbPos.x + fs));

    const minPanelHeight = 320;
    const spaceBelow = vh - (orbPos.y + fs + gap);
    const opensBelow = spaceBelow >= minPanelHeight;
    if (opensBelow) style.top = orbPos.y + fs + gap;
    else style.bottom = Math.max(ORB_MARGIN, vh - orbPos.y + gap);

    // Zoom the panel in from whichever corner of it sits nearest the orb.
    style.transformOrigin = `${opensBelow ? 'top' : 'bottom'} ${onLeft ? 'left' : 'right'}`;

    return style;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable, orbPos]);

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
    setReplyContext,
    clearReplyContext,
    resetChat,
    handleKeyDown,
    submitFeedback,
    attachments,
    attachmentError,
    attachmentsEnabled,
    acceptFileTypes,
    addFiles,
    removeAttachment,
    messageQueue,
    maxQueuedMessages,
    removeQueuedMessage,
  } = useChat();

  // Expose chat actions to external consumers via actionsRef
  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = { submit: submitFromRenderer, submitSilent, appendBubble, prefillInput, setReplyContext, clearReplyContext, getMessages: () => messages, reset: resetChat };
    return () => { if (actionsRef) actionsRef.current = null; };
  });

  const chatActions = useMemo(
    () => ({
      actions: {
        submit:       submitFromRenderer,
        submitSilent,
        appendBubble,
        prefillInput,
        setReplyContext,
        clearReplyContext,
      },
    }),
    [submitFromRenderer, submitSilent, appendBubble, prefillInput, setReplyContext, clearReplyContext],
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

  // Popout overrides corner anchor with absolute drag position, plus a fixed
  // width/height once the user has actually resized it (null = keep the
  // normal CSS-driven content-hugging size). `isInteracting` kills the
  // panel's CSS transition while actively dragging/resizing so inline style
  // updates track the pointer 1:1 instead of animating behind it.
  const popoutStyle = (isPopout && !isMinimized && popoutPos.x !== null)
    ? {
        position: 'fixed', left: popoutPos.x, top: popoutPos.y, right: 'auto', bottom: 'auto', transform: 'none',
        ...(popoutSize.width  != null ? { width: popoutSize.width } : {}),
        ...(popoutSize.height != null ? { height: popoutSize.height, maxHeight: popoutSize.height } : {}),
        ...(isInteracting ? { transition: 'none' } : {}),
      }
    : {};

  // ── Drag-to-move in popout mode — the whole header bar is the drag handle
  //    now (not just the title/brand area), like a native window's title bar.
  //    Clicks that land on a real control (button, menu, etc.) fall through
  //    untouched so they still work. ─────────────────────────────────────
  const onTitleDragStart = (e) => {
    if (!isPopout || isMinimized) return;
    if (e.target.closest('button, a, input, select, textarea, [role="menu"], [role="menuitem"]')) return;
    e.preventDefault();
    const panel = e.currentTarget.closest('.ce-panel');
    const rect  = panel?.getBoundingClientRect?.();
    const w = rect?.width  ?? 460;
    const h = rect?.height ?? 600;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX:  popoutPos.x ?? rect?.left ?? 200,
      origY:  popoutPos.y ?? rect?.top  ?? 100,
    };
    setIsInteracting(true);
    function onMove(ev) {
      if (!dragRef.current.active) return;
      // Keep at least ~100px of the header grabbable on-screen so a
      // freely-dragged window can never be lost off-viewport.
      const nx = popoutClamp(dragRef.current.origX + ev.clientX - dragRef.current.startX, -(w - 100), window.innerWidth  - 100);
      const ny = popoutClamp(dragRef.current.origY + ev.clientY - dragRef.current.startY, 0,           window.innerHeight - 48);
      setPopoutPos({ x: nx, y: ny });
    }
    function onUp() {
      dragRef.current.active = false;
      setIsInteracting(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  // ── Resize-from-any-edge/corner in popout mode, like a native OS window ──
  // Pointer Events + setPointerCapture (mirrors the orb-drag pattern) so the
  // resize keeps tracking even if the cursor outruns the thin handle strip.
  const handleResizePointerDown = (edge) => (e) => {
    if (!isPopout || isMinimized) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = panelRef.current;
    const rect  = panel?.getBoundingClientRect?.();
    if (!rect) return;
    resizeRef.current = {
      active: true, edge,
      startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
      startLeft: rect.left, startTop: rect.top,
    };
    setIsInteracting(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleResizePointerMove = (e) => {
    const r = resizeRef.current;
    if (!r.active) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const margin = 24;
    let width  = r.startW;
    let height = r.startH;
    let left   = r.startLeft;
    let top    = r.startTop;

    // Each edge's max isn't a flat viewport size — it's however much room is
    // left between the panel's FIXED anchor edge (the one not being dragged)
    // and the corresponding viewport edge, so the panel can never be resized
    // past the window in either direction regardless of where it currently sits.
    if (r.edge.includes('e')) {
      const maxW = window.innerWidth - r.startLeft - margin;
      width = popoutClamp(r.startW + dx, POPOUT_MIN_WIDTH, maxW);
    }
    if (r.edge.includes('s')) {
      const maxH = window.innerHeight - r.startTop - margin;
      height = popoutClamp(r.startH + dy, POPOUT_MIN_HEIGHT, maxH);
    }
    if (r.edge.includes('w')) {
      const maxW = r.startLeft + r.startW - margin;
      width = popoutClamp(r.startW - dx, POPOUT_MIN_WIDTH, maxW);
      left  = r.startLeft + (r.startW - width);
    }
    if (r.edge.includes('n')) {
      const maxH = r.startTop + r.startH - margin;
      height = popoutClamp(r.startH - dy, POPOUT_MIN_HEIGHT, maxH);
      top    = r.startTop + (r.startH - height);
    }

    setPopoutSize({ width, height });
    if (r.edge.includes('w') || r.edge.includes('n')) setPopoutPos({ x: left, y: top });
  };

  const handleResizePointerUp = () => {
    if (!resizeRef.current.active) return;
    resizeRef.current.active = false;
    setIsInteracting(false);
  };

  // Keep a resized/dragged popout on-screen and within bounds if the
  // viewport itself shrinks (window resize, orientation change, etc.).
  useEffect(() => {
    if (!isPopout) return;
    function handleViewportResize() {
      setPopoutSize((size) => {
        if (size.width == null && size.height == null) return size;
        const maxW = window.innerWidth  - 24;
        const maxH = window.innerHeight - 24;
        return {
          width:  size.width  != null ? popoutClamp(size.width,  POPOUT_MIN_WIDTH,  maxW) : null,
          height: size.height != null ? popoutClamp(size.height, POPOUT_MIN_HEIGHT, maxH) : null,
        };
      });
      setPopoutPos((pos) => {
        if (pos.x == null) return pos;
        return {
          x: popoutClamp(pos.x, -300, window.innerWidth  - 100),
          y: popoutClamp(pos.y, 0,    window.innerHeight - 48),
        };
      });
    }
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [isPopout]);

  // ── New chat with confirmation if messages exist ──────────────────────────
  const handleNewChat = () => {
    // Confirm only when there is something to lose, unless the consumer has
    // said otherwise: `always` for a surface where a reset is expensive
    // (it clears server-side scratch state), `never` for one where a new chat
    // is cheap and the extra click is just friction.
    const mode = config.newChatConfirm?.when ?? 'when-not-empty';
    const needsConfirm = mode === 'always'
      || (mode !== 'never' && messages.length > 0);
    if (needsConfirm) setConfirmNewChat(true);
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

      {/* Mode picker — sidepanel modes (needs onModeChange) + optional
          "Fullscreen (new tab)" when a fullscreenTabUrl / callback is set. */}
      {config.showLayoutPicker && (onModeChange || hasFullscreenTab(config)) && (
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
              {onModeChange && modeOptions.map((opt) => (
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
              {hasFullscreenTab(config) && (
                <button
                  role="menuitem"
                  className="ce-mode-menu-item"
                  onClick={() => { setModeMenuOpen(false); openFullscreenTab(config); }}
                >
                  <PopoutIcon style={{ width: 15, height: 15, marginRight: 6 }} />
                  Fullscreen (new tab)
                </button>
              )}
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
        ref={panelRef}
        className={`ce-panel ${posClass} ${alignClass} ${panelStateClass} ${config.showFab === false ? 'ce-panel--nofab' : ''}`}
        style={{ ...orbPanelStyle, ...popoutStyle }}
        role="dialog"
        aria-modal="false"
        aria-label="Chat panel"
        aria-hidden={!isOpen}
      >
        {/* ── Resize handles — popout mode only, like a native window's edges/corners ── */}
        {isPopout && !isMinimized && (
          <>
            <div className="ce-resize-handle ce-resize-handle--n"  onPointerDown={handleResizePointerDown('n')}  onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--s"  onPointerDown={handleResizePointerDown('s')}  onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--e"  onPointerDown={handleResizePointerDown('e')}  onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--w"  onPointerDown={handleResizePointerDown('w')}  onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--ne" onPointerDown={handleResizePointerDown('ne')} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--nw" onPointerDown={handleResizePointerDown('nw')} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--se" onPointerDown={handleResizePointerDown('se')} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
            <div className="ce-resize-handle ce-resize-handle--sw" onPointerDown={handleResizePointerDown('sw')} onPointerMove={handleResizePointerMove} onPointerUp={handleResizePointerUp} onPointerCancel={handleResizePointerUp} />
          </>
        )}

        {/* ── Confirm new-chat dialog — overlays only the panel */}
        {confirmNewChat && (
          <div
            className="ce-confirm-overlay"
            style={{ position: 'absolute', inset: 0, zIndex: 10 }}
          >
            <div className="ce-confirm-dialog">
              <p className="ce-confirm-msg">{config.newChatConfirm?.message
                  ?? 'Start a new chat? Your current conversation will be cleared.'}</p>
              <div className="ce-confirm-btns">
                <button className="ce-confirm-cancel" onClick={() => setConfirmNewChat(false)}>
                  {config.newChatConfirm?.cancelLabel ?? 'Cancel'}</button>
                <button className="ce-confirm-ok" onClick={() => { resetChat(); setConfirmNewChat(false); }}>
                  {config.newChatConfirm?.confirmLabel ?? 'New Chat'}</button>
              </div>
            </div>
          </div>
        )}

        <ChatHeader
          title={config.title}
          showDarkModeLightMode={config.showDarkModeLightMode}
          showAudit={false}
          showHeaderDot={config.showHeaderDot}
          showTransportBadge={config.showTransportBadge}
          transport={config.stream?.enabled ? (config.stream?.transport ?? 'sse') : 'rest'}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onDragStart={onTitleDragStart}
          actions={headerActions}
        />

        {!isMinimized && subHeader && <div className="ce-subheader">{subHeader}</div>}

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
            onChipClick={(text) => submitFromRenderer(text)}
            attachments={attachments}
            attachmentError={attachmentError}
            attachmentsEnabled={attachmentsEnabled}
            acceptFileTypes={acceptFileTypes}
            onFilesPicked={addFiles}
            onRemoveAttachment={removeAttachment}
            messageQueue={messageQueue}
            maxQueuedMessages={maxQueuedMessages}
            onCancelQueued={removeQueuedMessage}
          />
        )}
      </div>  {/* end ce-panel */}

      {/* ── FAB launcher button — hidden when the consumer provides its own
          trigger via config.showFab:false (e.g. drives `open` externally). ── */}
      {config.showFab !== false && (
        <button
          ref={fabRef}
          type="button"
          className={`ce-fab ${fabPosClass} ${fabAlignClass} ${isOpen ? 'ce-fab--active' : ''} ${draggable ? 'ce-fab--draggable' : ''} ${orbDragging ? 'ce-fab--dragging' : ''}`}
          title={isOpen ? 'Close chat' : 'Open chat'}
          aria-label={isOpen ? 'Close chat' : 'Open chat'}
          aria-expanded={isOpen}
          aria-controls="ce-chat-panel"
          style={orbFabStyle}
          onPointerDown={draggable ? handleOrbPointerDown : undefined}
          onPointerMove={draggable ? handleOrbPointerMove : undefined}
          onPointerUp={draggable ? handleOrbPointerUp : undefined}
          onPointerCancel={draggable ? handleOrbPointerUp : undefined}
          onClick={draggable ? handleOrbClick : () => {
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
      )}
    </>
    </ChatActionsContext.Provider>
  );
}

import { useIcons } from '../../hooks/useIcons.js';

/**
 * Top bar of the chat panel / fullscreen mode.
 * Renders the title and optional action buttons (dark-mode toggle, audit toggle).
 */
export function ChatHeader({
  title = 'ConvEngine Assistant',
  showDarkModeLightMode = false,
  showAudit = false,
  showHeaderDot = true,
  isDark = false,
  auditOpen = false,
  onToggleTheme,
  onToggleAudit,
  onNewChat,
  // When set, the header brand area becomes a drag handle (used in popout mode)
  onDragStart,
  // Optional slot for panel mode (minimize / close)
  actions,
}) {
  const { AuditIcon, MinimizeIcon, MoonIcon, SunIcon, NewChatIcon } = useIcons();
  return (
    <header className="ce-header">
      <div
        className="ce-header-brand"
        onMouseDown={onDragStart}
        style={onDragStart ? { cursor: 'move', userSelect: 'none' } : undefined}
      >
        {showHeaderDot && <span className="ce-header-dot" aria-hidden="true" />}
        <span className="ce-header-title">{title}</span>
      </div>

      <div className="ce-header-actions">
        {onNewChat && (
          <button
            type="button"
            className="ce-header-btn"
            title="New chat"
            aria-label="Start new chat"
            onClick={onNewChat}
          >
            <NewChatIcon />
          </button>
        )}
        {showAudit && (
          <button
            type="button"
            className={`ce-header-btn ${auditOpen ? 'ce-header-btn--active' : ''}`}
            title={auditOpen ? 'Hide audit trail' : 'Show audit trail'}
            aria-label={auditOpen ? 'Hide audit trail' : 'Show audit trail'}
            aria-pressed={auditOpen}
            onClick={onToggleAudit}
          >
            <AuditIcon />
          </button>
        )}

        {showDarkModeLightMode && (
          <button
            type="button"
            className="ce-header-btn"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={onToggleTheme}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        )}

        {/* Extra slot — panel mode injects minimize/close here */}
        {actions}
      </div>
    </header>
  );
}

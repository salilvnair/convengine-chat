import { AuditIcon, MinimizeIcon, MoonIcon, SunIcon, NewChatIcon } from '../../icons/Icons.jsx';

/**
 * Top bar of the chat panel / fullscreen mode.
 * Renders the title and optional action buttons (dark-mode toggle, audit toggle).
 */
export function ChatHeader({
  title = 'ConvEngine Chat',
  showDarkModeLightMode = false,
  showAudit = false,
  isDark = false,
  auditOpen = false,
  onToggleTheme,
  onToggleAudit,
  onNewChat,
  // Optional slot for panel mode (minimize / close)
  actions,
}) {
  return (
    <header className="ce-header">
      <div className="ce-header-brand">
        <span className="ce-header-dot" aria-hidden="true" />
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

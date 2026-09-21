import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';
import { useIcons } from '../../hooks/useIcons.js';

/**
 * Where the header's "Open Audit Explorer" button goes.
 *
 * Off by default. Turn it on with config.showAuditExplorer and tell it where
 * the explorer lives — either a URL (config.auditExplorerUrl, opened in a new
 * tab by default) or a callback (config.onOpenAuditExplorer) for apps that
 * route internally. The current conversation id is passed along either way, so
 * the explorer opens on the conversation you were just in.
 */
export function auditExplorerHref(config, conversationId) {
  const base = config?.auditExplorerUrl;
  if (!base) return null;
  if (config.auditExplorerLinkConversation === false || !conversationId) return String(base);
  try {
    const url = new URL(base, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    url.searchParams.set(config.auditExplorerParam || 'conversationId', conversationId);
    // Keep a relative URL relative, so it resolves the same way the consumer wrote it.
    return /^https?:\/\//i.test(base) ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return String(base);
  }
}

export function canOpenAuditExplorer(config) {
  return !!config?.showAuditExplorer && !!(config.auditExplorerUrl || typeof config.onOpenAuditExplorer === 'function');
}

export function AuditExplorerButton() {
  const { config, conversationId } = useConvEngineChatContext();
  const { AuditExplorerIcon } = useIcons();
  if (!canOpenAuditExplorer(config)) return null;

  const open = () => {
    if (typeof config.onOpenAuditExplorer === 'function') {
      config.onOpenAuditExplorer(conversationId);
      return;
    }
    const href = auditExplorerHref(config, conversationId);
    if (href && typeof window !== 'undefined') {
      window.open(href, config.auditExplorerTarget ?? '_blank', 'noopener');
    }
  };

  const label = config.auditExplorerLabel ?? 'Open Audit Explorer';
  return (
    <button type="button" className="ce-header-btn" title={label} aria-label={label} onClick={open}>
      <AuditExplorerIcon />
    </button>
  );
}

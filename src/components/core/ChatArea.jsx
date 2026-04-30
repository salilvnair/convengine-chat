import { ChatLanding } from './ChatLanding.jsx';
import { ChatThread } from './ChatThread.jsx';
import { ChatComposer } from './ChatComposer.jsx';
import { AuditPanel } from './AuditPanel.jsx';
import { useConvEngineChatContext } from '../../context/ConvEngineChatContext.jsx';

/* ── Fullscreen status chip strip ─────────────────────────────────────────── */
function StatusChip({ label, value, color }) {
  if (!value) return null;
  return (
    <span className="ce-status-chip" style={{ '--chip-color': color }}>
      <span className="ce-status-chip-label">{label}:</span>
      <span className="ce-status-chip-value">{value}</span>
    </span>
  );
}

function EngineStatusBar({ engineStatus }) {
  if (!engineStatus) return null;
  const { intent, state, elapsed } = engineStatus;
  if (!intent && !state && !elapsed) return null;
  return (
    <div className="ce-engine-status-bar">
      <StatusChip label="intent" value={intent} color="#f59e0b" />
      <StatusChip label="state"  value={state}  color="#10b981" />
      {elapsed != null && (
        <StatusChip label="time" value={`${elapsed}ms`} color="#6366f1" />
      )}
    </div>
  );
}

/**
 * Main content area of the chat interface.
 * Transitions from landing → active chat once the first message is sent.
 *
 * @param {string} [variant]  "fullscreen" enables fullscreen-specific layout
 */
export function ChatArea({
  variant,
  isInitial,
  input,
  isTyping,
  isMultiLine,
  inputRef,
  onInputChange,
  onKeyDown,
  onSend,
  threadRef,
  messages,
  progressText,
  onFeedback,
  auditRevision,
  auditOpen,
  onCloseAudit,
  engineStatus,
}) {
  const { config } = useConvEngineChatContext();
  const isFullscreen = variant === 'fullscreen';

  if (isInitial) {
    // Fullscreen: title stays centered, composer always lives in the bottom footer
    if (isFullscreen) {
      return (
        <div className="ce-chat-body">
          <ChatLanding
            fullscreen
            hideComposer
            title={config.title}
            subtitle={config.subtitle}
            showAvatar={config.showLandingAvatar}
            showSubtitle={config.showLandingSubtitle}
          />
          <footer className="ce-footer ce-footer--fullscreen">
            <ChatComposer
              fullscreen
              inputRef={inputRef}
              input={input}
              isTyping={isTyping}
              isMultiLine={isMultiLine}
              onInputChange={onInputChange}
              onKeyDown={onKeyDown}
              onSend={onSend}
              placeholder={config.placeholder}
            />
          </footer>
        </div>
      );
    }
    return (
      <ChatLanding
        fullscreen={false}
        title={config.title}
        subtitle={config.subtitle}
        showAvatar={config.showLandingAvatar}
        showSubtitle={config.showLandingSubtitle}
        placeholder={config.placeholder}
        input={input}
        isTyping={isTyping}
        isMultiLine={isMultiLine}
        inputRef={inputRef}
        onInputChange={onInputChange}
        onKeyDown={onKeyDown}
        onSend={onSend}
      />
    );
  }

  return (
    <div className={`ce-chat-body ${auditOpen && config.showAudit ? 'ce-chat-body--with-audit' : ''}`}>
      {isFullscreen && <EngineStatusBar engineStatus={engineStatus} />}

      <ChatThread
        threadRef={threadRef}
        messages={messages}
        isTyping={isTyping}
        progressText={progressText}
        onFeedback={onFeedback}
        fullscreen={isFullscreen}
      />

      {auditOpen && config.showAudit && (
        <AuditPanel auditRevision={auditRevision} onClose={onCloseAudit} />
      )}

      <footer className={`ce-footer ${isFullscreen ? 'ce-footer--fullscreen' : ''}`}>
        <ChatComposer
          inputRef={inputRef}
          input={input}
          isTyping={isTyping}
          isMultiLine={isMultiLine}
          onInputChange={onInputChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
          placeholder={config.placeholder}
          fullscreen={isFullscreen}
        />
      </footer>
    </div>
  );
}

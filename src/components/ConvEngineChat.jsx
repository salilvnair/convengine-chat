import { useState, useEffect } from 'react';
import { ConvEngineChatProvider } from '../context/ConvEngineChatContext.jsx';
import { PanelMode } from './core/PanelMode.jsx';
import { FullscreenMode } from './core/FullscreenMode.jsx';
import { SidepanelMode } from './core/SidepanelMode.jsx';
import { useTheme } from '../hooks/useTheme.js';
import '../styles/convengine-chat.css';

/**
 * Converts a theme token map into an inline style object.
 *
 * Consumers can pass either full CSS variable names or shorthand keys:
 *   { '--ce-color-accent': '#e11d48' }            // full CSS var name
 *   { 'color-accent': '#e11d48' }                  // auto-prefixed with --ce-
 *
 * This is the CSS-custom-property bridge for both plain-CSS and
 * Tailwind-based consumer apps.  Tailwind users can also reference
 * these tokens in their tailwind.config.js:
 *   theme: { extend: { colors: { brand: 'var(--ce-color-accent)' } } }
 */
function resolveThemeStyle(theme) {
  if (!theme || typeof theme !== 'object') return undefined;
  const style = {};
  for (const [key, value] of Object.entries(theme)) {
    const cssVar = key.startsWith('--') ? key : `--ce-${key}`;
    style[cssVar] = value;
  }
  return Object.keys(style).length ? style : undefined;
}

function isSolidColorToken(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !/gradient\s*\(/i.test(value)
  );
}

/**
 * ConvEngineChat — the single public component for consumers.
 *
 * @param {object}  props
 * @param {"panel"|"fullscreen"|"sidepanel"} [props.mode="panel"]
 *   - "panel"      → floating FAB + anchored chat card (default)
 *   - "fullscreen" → fills its parent container (great for full-page layouts)
 *   - "sidepanel"  → full-height drawer anchored to the left or right edge
 *
 * @param {"bottom"|"top"} [props.position="bottom"]
 *   Vertical anchor for panel mode.
 *
 * @param {"right"|"left"} [props.align="right"]
 *   Horizontal anchor for panel mode.
 *
 * @param {object} [props.config={}]
 *   Configuration bag:
 *   {
 *     apiHost?:               string,    // ConvEngine backend URL
 *     conversationId?:        string,    // Resume a conversation
 *     title?:                 string,    // Header / landing title
 *     placeholder?:           string,    // Input placeholder
 *     showAudit?:             boolean,   // Audit trail panel (default: false)
 *     showFeedback?:          boolean,   // 👍👎 feedback row (default: true)
 *     showDarkModeLightMode?: boolean,   // Dark/light toggle (default: false)
 *     renderers?:             Array,     // Custom renderer providers
 *     onMessage?:             Function,  // (userText) => void
 *     onResponse?:            Function,  // (assistantText) => void
 *   }
 *
 * @param {object} [props.theme={}]
 *   CSS custom-property overrides — re-skin without touching CSS.
 *   Keys are either full var names or shorthand (auto-prefixed with --ce-):
 *   {
 *     '--ce-color-accent': '#e11d48',   // full name
 *     'panel-width': '480px',           // shorthand → --ce-panel-width
 *     'font-family': '"Inter", sans-serif',
 *   }
 *   Tailwind consumers can also reference these tokens in tailwind.config.js:
 *   theme: { extend: { colors: { brand: 'var(--ce-color-accent)' } } }
 *
 * @example
 *   <ConvEngineChat mode="panel" position="bottom" align="right"
 *     config={{ apiHost: "http://localhost:8080", showFeedback: false }} />
 *
 *   <ConvEngineChat mode="fullscreen"
 *     config={{ showAudit: true }}
 *     theme={{ 'color-accent': '#7c3aed', 'panel-width': '480px' }} />
 */
export function ConvEngineChat({
  mode = 'panel',
  position = 'bottom',
  align = 'right',
  config = {},
  theme = {},
  onModeChange,
  actionsRef = null,
}) {
  const { isDark, toggleTheme } = useTheme(config.showDarkModeLightMode, config.defaultDark ?? false);

  // When the user switches mode from inside the widget (via the mode picker),
  // the newly-mounted mode component should start open. We set mountOpen=true
  // before calling the consumer's onModeChange, then reset it after the new
  // component has mounted (useEffect runs after the child's useState(initialOpen)).
  const [mountOpen, setMountOpen] = useState(false);
  useEffect(() => { setMountOpen(false); }, [mode]);

  function handleModeChange(newMode) {
    setMountOpen(true);
    onModeChange?.(newMode);
  }

  const rootClass = [
    'ce-chat-root',
    mode === 'fullscreen' ? 'ce-chat-root--fullscreen' : '',
    config.debugHighlightRenderers ? 'ce-debug-highlight-renderers' : '',
    config.debugDisableAnimations  ? 'ce-debug-no-animations'        : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Resolves a color value that may be a plain string or { light, dark } object.
  // Plain string applies to both themes; object picks the matching variant.
  function resolveColor(val) {
    if (!val) return null;
    if (typeof val === 'string') return val || null;
    if (typeof val === 'object') {
      return (isDark ? (val.dark ?? val.light) : (val.light ?? val.dark)) || null;
    }
    return null;
  }

  // Config shorthand color overrides — consumers can pass colors in config
  // without needing to know CSS variable names. theme prop takes precedence.
  // Accepts plain string OR { light: '...', dark: '...' } per-theme object.
  const configColors = {};
  const cu = resolveColor(config.bubbleUserBg);    if (cu) configColors['bg-bubble-user']    = cu;
  const ct = resolveColor(config.bubbleUserText);  if (ct) configColors['text-bubble-user']  = ct;
  const ca = resolveColor(config.bubbleAgentBg);   if (ca) configColors['bg-bubble-agent']   = ca;
  const cx = resolveColor(config.bubbleAgentText); if (cx) configColors['text-bubble-agent'] = cx;
  const cp = resolveColor(config.panelBg);         if (cp) configColors['bg-panel']          = cp;
  const cc = resolveColor(config.composerBg);      if (cc) configColors['bg-composer']       = cc;
  const ci = resolveColor(config.iconColor);       if (ci) configColors['icon-color']         = ci;
  const cuib = resolveColor(config.userIconBg);    if (cuib) configColors['avatar-user-bg']    = cuib;
  const cuic = resolveColor(config.userIconColor); if (cuic) configColors['avatar-user-color'] = cuic;
  const caib = resolveColor(config.agentIconBg);   if (caib) configColors['avatar-agent-bg']   = caib;
  const caic = resolveColor(config.agentIconColor);
  if (caic) {
    configColors['avatar-agent-color'] = caic;
  } else if (isSolidColorToken(ca)) {
    // If agent bubble bg is customized to a solid color, mirror that tone for
    // the avatar icon so it stays solid (user-avatar-like) instead of faded.
    configColors['avatar-agent-color'] = ca;
  }

  // Time label & date chip colors
  const ctlb  = resolveColor(config.timeLabelBg);           if (ctlb)  configColors['time-label-bg']     = ctlb;
  const ctlc  = resolveColor(config.timeLabelColor);        if (ctlc)  configColors['time-label-color']  = ctlc;
  const ctlbd = resolveColor(config.timeLabelBorderColor);  if (ctlbd) configColors['time-label-border'] = ctlbd;
  const cdlb  = resolveColor(config.dateLabelBg);           if (cdlb)  configColors['date-chip-bg']      = cdlb;
  const cdlc  = resolveColor(config.dateLabelColor);        if (cdlc)  configColors['date-chip-color']   = cdlc;
  const cdlbd = resolveColor(config.dateLabelBorderColor);  if (cdlbd) configColors['date-chip-border']  = cdlbd;

  // Merge: theme wins over config colors (explicit CSS var overrides take priority)
  const rootStyle = resolveThemeStyle({ ...configColors, ...theme }) ?? {};

  return (
    <ConvEngineChatProvider config={config}>
      <div
        className={rootClass}
        data-ce-theme={isDark ? 'dark' : 'light'}
        style={Object.keys(rootStyle).length ? rootStyle : undefined}
      >
        {mode === 'fullscreen' ? (
          <FullscreenMode isDark={isDark} toggleTheme={toggleTheme} actionsRef={actionsRef} />
        ) : mode === 'sidepanel' ? (
          <SidepanelMode
            align={align}
            isDark={isDark}
            toggleTheme={toggleTheme}
            onModeChange={handleModeChange}
            initialOpen={mountOpen}
            actionsRef={actionsRef}
          />
        ) : (
          <PanelMode
            position={position}
            align={align}
            isDark={isDark}
            toggleTheme={toggleTheme}
            onModeChange={handleModeChange}
            initialOpen={mountOpen}
            actionsRef={actionsRef}
          />
        )}
      </div>
    </ConvEngineChatProvider>
  );
}

export default ConvEngineChat;

import * as React from 'react';

// ── Shared helpers ────────────────────────────────────────────────────────────

/** A color value accepted by all color-override config keys.
 *  Pass a plain string for the same value in both modes,
 *  or `{ light, dark }` for per-theme values (like iOS Color Assets). */
export type ColorValue = string | { light?: string; dark?: string };

// ── Custom renderer ───────────────────────────────────────────────────────────

export interface RendererContext {
  effectiveType: string;
  payload: unknown;
  [key: string]: unknown;
}

export interface RendererActions {
  submit: (label: string, meta?: Record<string, unknown>) => void;
  [key: string]: unknown;
}

export interface RendererComponentProps {
  payload: unknown;
  actions: RendererActions;
  [key: string]: unknown;
}

export interface RendererDefinition {
  /** Unique key identifying this renderer */
  key: string;
  /** Higher priority runs before built-ins (built-in priority = 100) */
  priority?: number;
  /** Return true when this renderer should handle a message */
  match: (ctx: RendererContext) => boolean;
  Component: React.ComponentType<RendererComponentProps>;
}

// ── Custom icons ──────────────────────────────────────────────────────────────

export interface ConvEngineChatIcons {
  /** FAB open-button icon (use className="ce-icon", omit width/height) */
  ChatBubbleIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  AgentIcon?:      React.ComponentType<React.SVGProps<SVGSVGElement>>;
  UserIcon?:       React.ComponentType<React.SVGProps<SVGSVGElement>>;
  SendIcon?:       React.ComponentType<React.SVGProps<SVGSVGElement>>;
  ThumbUpIcon?:    React.ComponentType<React.SVGProps<SVGSVGElement>>;
  ThumbDownIcon?:  React.ComponentType<React.SVGProps<SVGSVGElement>>;
  [key: string]:   React.ComponentType<React.SVGProps<SVGSVGElement>> | undefined;
}

// ── API endpoint overrides ────────────────────────────────────────────────────

export interface ConvEngineChatApiEndpoints {
  /** Default: `/api/v1/conversation/message` */
  message?: string;
  /** Default: `/api/v1/conversation/feedback` */
  feedback?: string;
  /** Default: `/api/v1/conversation/audit` (/:conversationId appended automatically) */
  audit?: string;
  [key: string]: string | undefined;
}

// ── Message enrichment ────────────────────────────────────────────────────────

export interface ConvEngineChatMessageEnrichment {
  /**
   * - `'none'` — no enrichment (default)
   * - `'text'` — wraps with prefix/postfix as a plain string
   * - `'json'` — sends structured `inputParams` to the backend; user bubble unchanged
   */
  mode?: 'none' | 'text' | 'json';
  prefix?: string;
  postfix?: string;
  props?: Record<string, unknown>;
}

// ── Stream config ─────────────────────────────────────────────────────────────

export interface ConvEngineStreamConfig {
  enabled: boolean;
  /** @default 'sse' */
  transport?: 'sse' | 'stomp';
  /** Override WebSocket base URL (STOMP transport only) */
  wsBase?: string;
}

// ── Main component config ─────────────────────────────────────────────────────

export interface ConvEngineChatConfig {
  // ── Backend ────────────────────────────────────────────────────────────────
  /** Base URL of your backend, e.g. `'http://localhost:8080'` or `'/o1cd-convengine'`.
   *  Omit (or pass `''`) for same-origin servers. @default '' */
  apiHost?: string;
  /** Resume an existing conversation by ID. */
  conversationId?: string;
  /** Override individual endpoint paths. Unspecified endpoints keep their defaults. */
  apiEndpoints?: ConvEngineChatApiEndpoints;

  // ── Text & Labels ──────────────────────────────────────────────────────────
  /** Header title and landing screen heading. @default 'ConvEngine Assistant' */
  title?: string;
  /** Landing screen subtitle. @default "Ask me anything — I'll do my best to help." */
  subtitle?: string;
  /** Composer input placeholder. @default 'Ask ConvEngine…' */
  placeholder?: string;

  // ── Visibility flags ───────────────────────────────────────────────────────
  /** 👍👎 row under every AI message. @default true */
  showFeedback?: boolean;
  /** Audit trail side panel (fullscreen only). @default false */
  showAudit?: boolean;
  /** Engine status / progress indicator. @default true */
  showEngineStatus?: boolean;
  /** 🌙/☀️ toggle in header. @default false */
  showDarkModeLightMode?: boolean;
  /** Pulsing dot next to header title. @default true */
  showHeaderDot?: boolean;
  /** Bot avatar on landing screen. @default true */
  showLandingAvatar?: boolean;
  /** Subtitle on landing screen. @default true */
  showLandingSubtitle?: boolean;
  /** "New Chat" button (panel + fullscreen). @default true */
  showNewChat?: boolean;
  /** Mode-picker button in header (panel only). @default true */
  showLayoutPicker?: boolean;
  /** Expand-to-fullscreen button (panel only). @default true */
  showMaximize?: boolean;
  /** Minimize button (panel only). @default true */
  showMinimize?: boolean;

  // ── Appearance ─────────────────────────────────────────────────────────────
  /** Open in dark mode on first render. @default false */
  defaultDark?: boolean;
  /** Pill (round) or rounded-rectangle (rect) composer input. @default 'round' */
  composerShape?: 'round' | 'rect';

  // ── Color overrides ────────────────────────────────────────────────────────
  /** User message bubble fill. Overrides `--ce-bg-bubble-user`. */
  bubbleUserBg?: ColorValue;
  /** User message bubble text color. Overrides `--ce-text-bubble-user`. */
  bubbleUserText?: ColorValue;
  /** Assistant message bubble fill. Overrides `--ce-bg-bubble-agent`. */
  bubbleAgentBg?: ColorValue;
  /** Assistant message bubble text color. Overrides `--ce-text-bubble-agent`. */
  bubbleAgentText?: ColorValue;
  /** Chat panel / sidepanel background. Overrides `--ce-bg-panel`. */
  panelBg?: ColorValue;
  /** Composer (input area) background. Overrides `--ce-bg-composer`. */
  composerBg?: ColorValue;
  /** Resting color of header icon buttons. Overrides `--ce-icon-color`. */
  iconColor?: ColorValue;

  // ── Customisation ──────────────────────────────────────────────────────────
  /** Replace built-in SVG icons with your own React components. */
  icons?: ConvEngineChatIcons;
  /** Register custom message-type renderers. */
  renderers?: RendererDefinition[];

  // ── Lifecycle callbacks ────────────────────────────────────────────────────
  /** Fired when the user sends a message. */
  onMessage?: (text: string) => void;
  /** Fired when an assistant response arrives. */
  onResponse?: (text: string) => void;

  // ── Debug flags — all default false, zero cost when off ───────────────────
  /** Always show the "Agent is thinking…" typing indicator — no message needed.
   *  Useful for previewing the typing indicator and progress text during development.
   *  @default false */
  debugShowVerbose?: boolean;
  /** Show the raw response payload in a monospace block below every assistant bubble.
   *  JSON payloads are pretty-printed automatically.
   *  @default false */
  debugShowPayload?: boolean;
  /** Show a chip on every assistant bubble indicating which renderer key matched
   *  (e.g. `"default"`, `"faq-answer"`, `"error"`).
   *  @default false */
  debugShowRenderer?: boolean;
  /** Show an HH:mm:ss timestamp chip on every message bubble (both user and assistant).
   *  @default false */
  debugShowTimestamps?: boolean;
  /** Show a truncated bubble ID chip on every message bubble (both user and assistant).
   *  Useful for correlating React state with rendered bubbles.
   *  @default false */
  debugShowMessageId?: boolean;

  /** Add an artificial delay (in ms) before every API response. Use to preview
   *  loading states and typing indicator animations without a slow real backend.
   *  Set to `0` (default) to disable.
   *  @default 0 */
  debugSimulateDelay?: number;
  /** Force every send to throw a simulated error bubble instead of calling the API.
   *  Use to preview error bubble styling and test recovery flows.
   *  @default false */
  debugSimulateError?: boolean;
  /** Add a dashed outline around every message bubble — amber for user, blue for agent.
   *  Use to verify renderer region boundaries and layout during development.
   *  @default false */
  debugHighlightRenderers?: boolean;
  /** Disable all CSS transitions and animations on the widget.
   *  Useful for screenshot testing or reducing visual noise while inspecting layout.
   *  @default false */
  debugDisableAnimations?: boolean;

  // ── Bubble timestamps & date separators ────────────────────────────────────
  /** Show a time caption below every message bubble (user + assistant).
   *  Format is controlled by `bubbleTimeFormat`.
   *  @default false */
  showBubbleTime?: boolean;
  /** Time format string for the bubble time caption.
   *  Supported tokens: `h hh H HH mm ss A a`
   *  Examples: `'h:mm A'` → "12:14 PM", `'HH:mm'` → "14:14", `'h:mm:ss A'` → "12:14:05 PM"
   *  @default 'h:mm A' */
  bubbleTimeFormat?: string;
  /** Show sticky date separator chips between messages from different days.
   *  The chip sticks at the top of the scroll container while you scroll through the same day.
   *  @default false */
  showDateSeparators?: boolean;
  /** Date format for the separator chip.
   *  Use `'auto'` for "Today / Yesterday / ddd, MMM D".
   *  Supported tokens: `YYYY YY MMMM MMM MM M dddd ddd DD D`
   *  Examples: `'auto'`, `'ddd, MMM D'`, `'MMMM D, YYYY'`, `'DD/MM/YYYY'`
   *  @default 'auto' */
  dateSeparatorFormat?: string;
  /** Shape of the date separator chip.
   *  - `'round'` — pill shape (default)
   *  - `'rect'`  — rounded rectangle
   *  @default 'round' */
  dateSeparatorShape?: 'round' | 'rect';

  // ── Bubble time & date chip colors ────────────────────────────────────────
  /** Background of the time caption below bubbles. Accepts a plain string or `{ light, dark }`.
   *  CSS var: `--ce-time-label-bg` */
  timeLabelBg?: string | { light?: string; dark?: string };
  /** Text color of the time caption. CSS var: `--ce-time-label-color` */
  timeLabelColor?: string | { light?: string; dark?: string };
  /** Border color of the time caption. CSS var: `--ce-time-label-border` */
  timeLabelBorderColor?: string | { light?: string; dark?: string };
  /** Background of the date separator chip. CSS var: `--ce-date-chip-bg` */
  dateLabelBg?: string | { light?: string; dark?: string };
  /** Text color of the date separator chip. CSS var: `--ce-date-chip-color` */
  dateLabelColor?: string | { light?: string; dark?: string };
  /** Border color of the date separator chip. CSS var: `--ce-date-chip-border` */
  dateLabelBorderColor?: string | { light?: string; dark?: string };

  // ── Advanced ───────────────────────────────────────────────────────────────
  /** Message enrichment — prefix/postfix/wrap sent messages. */
  messageEnrichment?: ConvEngineChatMessageEnrichment;
  /** Streaming configuration (SSE or STOMP). */
  stream?: ConvEngineStreamConfig;

  [key: string]: unknown;
}

// ── ConvEngineChat component ──────────────────────────────────────────────────

export interface ConvEngineChatProps {
  /** Rendering mode.
   *  - `'panel'`      — floating FAB card (default)
   *  - `'sidepanel'`  — full-height edge drawer
   *  - `'fullscreen'` — fills its parent container
   *  @default 'panel' */
  mode?: 'panel' | 'sidepanel' | 'fullscreen';
  /** Vertical FAB anchor (panel mode only). @default 'bottom' */
  position?: 'bottom' | 'top';
  /** Horizontal FAB anchor / sidepanel side. @default 'right' */
  align?: 'right' | 'left';
  /** Runtime configuration. */
  config?: ConvEngineChatConfig;
  /** CSS custom-property overrides, auto-prefixed with `--ce-`.
   *  e.g. `{ 'color-accent': '#6366f1', 'panel-width': '460px' }` */
  theme?: Record<string, string>;
  /** Called with the new mode string when the user switches mode from the header picker. */
  onModeChange?: (mode: 'panel' | 'sidepanel' | 'fullscreen') => void;
}

export declare function ConvEngineChat(props: ConvEngineChatProps): React.ReactElement | null;

// ── Context & provider ────────────────────────────────────────────────────────

export interface ConvEngineChatContextValue {
  conversationId: string | null;
  apiClient: unknown;
  streamClient: unknown;
  config: ConvEngineChatConfig & { stream: { enabled: boolean; transport: string; wsBase: string } };
}

export interface ConvEngineChatProviderProps {
  config?: ConvEngineChatConfig;
  children: React.ReactNode;
}

export declare function ConvEngineChatProvider(props: ConvEngineChatProviderProps): React.ReactElement;
export declare function useConvEngineChatContext(): ConvEngineChatContextValue;

// ── Chat actions context ──────────────────────────────────────────────────────

export interface ChatActions {
  /**
   * Add a user bubble and POST to the backend.
   * Pass `displayText = ''` to skip the visible user bubble.
   */
  submit: (displayText: string, inputParams?: Record<string, unknown>) => void;
  /**
   * POST to the backend without adding any user bubble.
   * Shorthand for `submit('', inputParams)`.
   */
  submitSilent: (inputParams?: Record<string, unknown>) => void;
  /**
   * Add a bubble to the thread client-side only — no API call.
   * Useful for local validation messages or step-progress indicators.
   * @param role — defaults to `'assistant'`
   */
  appendBubble: (text: string, role?: 'user' | 'assistant') => void;
  /**
   * Pre-populate the composer input so the user can review/edit before sending.
   * Focuses the input automatically.
   */
  prefillInput: (text: string) => void;
}

export interface ChatActionsContextValue {
  actions: ChatActions;
}

export declare function useChatActions(): ChatActionsContextValue;

// ── Message shape ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  feedback?: 'thumbsUp' | 'thumbsDown' | null;
  feedbackBusy?: boolean;
}

export interface EngineStatus {
  elapsed?: number;
  [key: string]: unknown;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export interface UseChatReturn {
  // State
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isTyping: boolean;
  progressText: string;
  engineStatus: EngineStatus | null;
  auditRevision: number;
  isInitial: boolean;
  isMultiLine: boolean;
  // Refs
  threadRef: React.RefObject<HTMLElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  // Actions
  sendMessage: () => void;
  /** Programmatic send triggered by an interactive renderer. */
  submitFromRenderer: (displayText: string, inputParams?: Record<string, unknown>) => void;
  /** POST to backend with no user bubble. */
  submitSilent: (inputParams?: Record<string, unknown>) => void;
  /** Inject a bubble client-side without calling the backend. */
  appendBubble: (text: string, role?: 'user' | 'assistant') => void;
  /** Pre-populate the composer input without sending. */
  prefillInput: (text: string) => void;
  /** Clear all conversation state. */
  resetChat: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  submitFeedback: (messageId: string, feedbackType: 'thumbsUp' | 'thumbsDown') => void;
  scrollToBottom: () => void;
}

export declare function useChat(): UseChatReturn;

export interface UseThemeReturn {
  isDark: boolean;
  toggleTheme: () => void;
}

/**
 * Manages light/dark theme state for a single chat instance.
 * @param showDarkModeLightMode — enables the toggle button
 * @param defaultDark — seed initial state
 */
export declare function useTheme(showDarkModeLightMode?: boolean, defaultDark?: boolean): UseThemeReturn;

export type ConvEngineChatIconMap = {
  [K in keyof ConvEngineChatIcons]-?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
} & {
  CloseIcon:            React.ComponentType<React.SVGProps<SVGSVGElement>>;
  MinimizeIcon:         React.ComponentType<React.SVGProps<SVGSVGElement>>;
  SunIcon:              React.ComponentType<React.SVGProps<SVGSVGElement>>;
  MoonIcon:             React.ComponentType<React.SVGProps<SVGSVGElement>>;
  AuditIcon:            React.ComponentType<React.SVGProps<SVGSVGElement>>;
  ChevronDownIcon:      React.ComponentType<React.SVGProps<SVGSVGElement>>;
  ChevronLeftIcon:      React.ComponentType<React.SVGProps<SVGSVGElement>>;
  ChevronRightIcon:     React.ComponentType<React.SVGProps<SVGSVGElement>>;
  MaximizeIcon:         React.ComponentType<React.SVGProps<SVGSVGElement>>;
  RestoreIcon:          React.ComponentType<React.SVGProps<SVGSVGElement>>;
  LayoutIcon:           React.ComponentType<React.SVGProps<SVGSVGElement>>;
  NewChatIcon:          React.ComponentType<React.SVGProps<SVGSVGElement>>;
  PanelLeftIcon:        React.ComponentType<React.SVGProps<SVGSVGElement>>;
  PanelRightIcon:       React.ComponentType<React.SVGProps<SVGSVGElement>>;
  PopoutIcon:           React.ComponentType<React.SVGProps<SVGSVGElement>>;
  RestoreFromMinIcon:   React.ComponentType<React.SVGProps<SVGSVGElement>>;
  LandingAvatarIcon:    React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

/** Returns merged icon map: library defaults overridden by `config.icons`. */
export declare function useIcons(): ConvEngineChatIconMap;

// ── Renderer extension API ────────────────────────────────────────────────────

/**
 * Resolves the correct renderer for a raw assistant response string.
 * @param rawText        — raw assistant response text
 * @param extraProviders — consumer-registered renderers (run before built-ins)
 */
export declare function resolveAssistantRenderer(
  rawText: string,
  extraProviders?: RendererDefinition[]
): { key: string; Component: React.ComponentType<RendererComponentProps>; payload: unknown };

export declare const DefaultRenderer: React.ComponentType<RendererComponentProps>;

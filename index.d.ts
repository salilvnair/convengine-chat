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

/** Payload passed to each `messageEnrichment.preHook` function. */
export interface MessageEnrichmentHookContext {
  /** Outgoing message text — already wrapped with prefix/suffix. */
  userText: string;
  /** Outgoing inputParams — already merged with `messageEnrichment.inputParams`. */
  inputParams: Record<string, unknown>;
}

/**
 * Runs before the request is sent. Hooks run sequentially (awaited) in array order.
 * Return a partial `{ userText?, inputParams? }` to shallow-merge into the context
 * passed to the next hook / the final request. Return nothing to leave it unchanged.
 */
export type MessageEnrichmentPreHook = (
  ctx: MessageEnrichmentHookContext,
) => void | Partial<MessageEnrichmentHookContext> | Promise<void | Partial<MessageEnrichmentHookContext>>;

/** Payload passed to each `messageEnrichment.postHook` function. */
export interface MessageEnrichmentPostHookContext extends MessageEnrichmentHookContext {
  /** Raw backend response for this message. */
  response: unknown;
}

/**
 * Runs after the backend responds. Hooks run sequentially (awaited) in array order.
 * Side-effect only (analytics, logging, syncing external state) — return values are ignored.
 */
export type MessageEnrichmentPostHook = (
  ctx: MessageEnrichmentPostHookContext,
) => void | Promise<void>;

/**
 * A "reply-to" / context pill pinned inside the composer (Reply-style).
 * Drive it declaratively via `config.replyContext` (reactive) or imperatively
 * via `actions.setReplyContext()` / `actions.clearReplyContext()`.
 */
export interface ConvEngineChatReplyContext {
  /** The quoted text shown in the pill (e.g. a node name or a message snippet). */
  text: string;
  /** The full text sent to the backend as `inputParams.replySourceText` on the
   *  next send. Defaults to `text` when omitted (used when `text` is truncated
   *  for display but you want the backend to see the whole thing). */
  replySourceText?: string;
  /** Small uppercase label above the quote, e.g. `'Replying to'`. */
  label?: string;
  /** Accent color for the pill's bar + label. Defaults to the widget accent. */
  accent?: string;
  /** Extra fields folded into `inputParams` on the next send (alongside
   *  `replySourceText`) — grounds the question. */
  meta?: Record<string, unknown>;
  /** Keep the pill after a send instead of clearing it (Reply clears by
   *  default). Use for a long-lived "current context" pin. @default false */
  persist?: boolean;
  /** If set, the pill becomes a link (e.g. jump to the referenced thing). */
  onClick?: () => void;
  /** Called when the ✕ is clicked (in addition to dropping the pill). */
  onClear?: () => void;
  /** Show the ✕ dismiss button. @default true */
  clearable?: boolean;
  /** Tooltip for the pill body. */
  title?: string;
}

export interface ConvEngineChatMessageEnrichment {
  /** Prepended to the outgoing message text, e.g. `'/faq'`. Optional. */
  prefix?: string;
  /** Appended to the outgoing message text. Optional. */
  suffix?: string;
  /** Merged into every request's `inputParams`. A renderer's own `inputParams`
   *  (from `actions.submit`/`actions.submitSilent`) win on key collision. */
  inputParams?: Record<string, unknown>;
  /** Functions run sequentially before the request is sent. */
  preHook?: MessageEnrichmentPreHook[];
  /** Functions run sequentially after the backend responds. */
  postHook?: MessageEnrichmentPostHook[];
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
  /** Seed the thread with pre-existing messages (used once at mount). Snapshot
   *  another instance's messages with `actions.getMessages()` and pass them here
   *  to carry a conversation over (e.g. "pop out to a tab"). */
  initialMessages?: ChatMessage[];
  /** Override individual endpoint paths. Unspecified endpoints keep their defaults. */
  apiEndpoints?: ConvEngineChatApiEndpoints;
  /** A reply/context pill pinned in the composer. Reactive — update it (or set
   *  it to `null`) as your app's "current context" changes. */
  replyContext?: ConvEngineChatReplyContext | null;

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
  /** Reply-to-message icon on assistant bubbles (hover). Clicking it quotes the
   *  bubble in the composer and sends its text as `inputParams.replySourceText`.
   *  @default true */
  showBubbleReply?: boolean;
  /** The built-in FAB launcher (panel mode). Set `false` when you drive `open`
   *  from your own trigger. @default true */
  showFab?: boolean;
  /** "Open fullscreen in a new tab" — a URL the widget opens in a new browser
   *  tab. When set (or `onOpenFullscreenTab` is), the layout picker gains a
   *  "Fullscreen (new tab)" option and fullscreen mode gains a header button. */
  fullscreenTabUrl?: string;
  /** Callback for "Open fullscreen in a new tab" — the consumer opens the tab
   *  itself (wins over `fullscreenTabUrl` when both are set). */
  onOpenFullscreenTab?: () => void;
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
  /** Fired when the user sends a message (raw text, before enrichment). */
  onMessage?: (text: string) => void;
  /** Fired when an assistant response arrives. */
  onResponse?: (text: string) => void;
  /** Fired right before every request is sent — composer, renderer `actions.submit`,
   *  and `actions.submitSilent` all go through this, including the built-in default
   *  renderer flow. Gives visibility into the fully-enriched payload (`apiText`/`inputParams`)
   *  that isn't otherwise available outside a custom renderer. */
  onSubmit?: (payload: { userText: string; apiText: string; inputParams: Record<string, unknown> }) => void;
  /** Fired right before 👍/👎 feedback is sent to the backend — same "before the
   *  request" timing as `onSubmit`. */
  onFeedback?: (feedback: {
    conversationId: string;
    messageId: string;
    feedbackType: string;
    assistantResponse: string;
  }) => void;

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
  /** Message enrichment — wrap outgoing text with prefix/suffix, attach static
   *  inputParams (e.g. `{ userId }`) to every request, and/or run pre/post hooks. */
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
  /** Overall widget scale — panel dimensions, font, bubbles, composer, avatars
   *  and the send button scale together. `md` is unchanged; `sm`/`xs` are
   *  compact; `lg` is roomier. @default 'md' */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Consumer content rendered in a slot directly below the header and above
   *  the chat body (every mode) — e.g. a conversation-history dropdown, a
   *  banner, or nothing. The library supplies only a flex-shrink wrapper. */
  subHeader?: React.ReactNode;
  /** Runtime configuration. */
  config?: ConvEngineChatConfig;
  /** CSS custom-property overrides, auto-prefixed with `--ce-`.
   *  e.g. `{ 'color-accent': '#6366f1', 'panel-width': '460px' }` */
  theme?: Record<string, string>;
  /** Called when the user picks a layout from the header mode picker. The id is
   *  compound so the consumer can decode both the mode AND the side in one value:
   *  - `'panel'`          → render `mode="panel"`
   *  - `'sidepanel-left'` → render `mode="sidepanel"` `align="left"`
   *  - `'sidepanel-right'`→ render `mode="sidepanel"` `align="right"`
   *  ("Fullscreen (new tab)" is a separate action — see `onOpenFullscreenTab`.) */
  onModeChange?: (mode: 'panel' | 'sidepanel-left' | 'sidepanel-right') => void;
  /** A ref that receives the imperative actions handle while mounted. */
  actionsRef?: React.MutableRefObject<ConvEngineChatActionsHandle | null> | null;
  /** Controlled open state (panel mode). When provided, the consumer owns the
   *  open state (drive it from your own launcher); pair with `onOpenChange` and
   *  usually `config.showFab: false`. Omit for the built-in FAB toggle. */
  open?: boolean;
  /** Called with the next open state when the panel opens/closes. */
  onOpenChange?: (open: boolean) => void;
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
  /** Pin a reply/context pill in the composer (imperative equivalent of
   *  `config.replyContext`). */
  setReplyContext: (ctx: ConvEngineChatReplyContext | null) => void;
  /** Remove the reply/context pill. */
  clearReplyContext: () => void;
}

export interface ChatActionsContextValue {
  actions: ChatActions;
}

/** The imperative handle exposed on `actionsRef.current` while the widget is mounted. */
export interface ConvEngineChatActionsHandle {
  submit: (displayText: string, inputParams?: Record<string, unknown>) => void;
  submitSilent: (inputParams?: Record<string, unknown>) => void;
  appendBubble: (text: string, role?: 'user' | 'assistant') => void;
  prefillInput: (text: string) => void;
  setReplyContext: (ctx: ConvEngineChatReplyContext | null) => void;
  clearReplyContext: () => void;
  /** Snapshot the current messages (e.g. to seed `config.initialMessages` on
   *  another instance when popping the conversation out to a tab). */
  getMessages: () => ChatMessage[];
  reset: () => void;
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
  /** The active reply/context pill, or `null`. */
  replyContext: ConvEngineChatReplyContext | null;
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
  /** Pin a reply/context pill in the composer. */
  setReplyContext: (ctx: ConvEngineChatReplyContext | null) => void;
  /** Remove the reply/context pill. */
  clearReplyContext: () => void;
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
  ReplyIcon:            React.ComponentType<React.SVGProps<SVGSVGElement>>;
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

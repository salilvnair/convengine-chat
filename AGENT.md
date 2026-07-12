# convengine-chat — Project Architecture Reference

This document describes the internal architecture, file structure, design decisions, and streaming implementation of the `@salilvnair/convengine-chat` React library.

> **Audience:** library contributors and maintainers.
> For consumer documentation see [README.md](./README.md).

---

## Project overview

`@salilvnair/convengine-chat` is a zero-dependency React chat widget that integrates with any ConvEngine conversational AI backend. It ships as an ES module + UMD bundle built by Vite and published to npm under the `@salilvnair` scope.

The library exposes a single public component (`<ConvEngineChat>`), a handful of hooks, and a renderer extension API. Consumers need only add the component and import the stylesheet.

---

## Repository structure

```
convengine-chat/
├── src/
│   ├── index.js                        # Public API barrel — all exports go through here
│   ├── api/
│   │   ├── client.js                   # REST API client (sendMessage, submitFeedback, getAudit)
│   │   └── stream.js                   # Stream client factory (SSE + STOMP transports)
│   ├── components/
│   │   ├── ConvEngineChat.jsx          # Root public component — wires provider + mode selector
│   │   ├── core/
│   │   │   ├── ChatArea.jsx            # Scrollable message list container
│   │   │   ├── ChatComposer.jsx        # Input field + send button
│   │   │   ├── ChatFeedbackRow.jsx     # 👍👎 row below each assistant message
│   │   │   ├── ChatHeader.jsx          # Header bar (title, transport badge, actions)
│   │   │   ├── ChatLanding.jsx         # Empty-state screen (avatar + subtitle)
│   │   │   ├── ChatThread.jsx          # Message list + typing indicator
│   │   │   ├── ChatTypingIndicator.jsx # Animated dots + stream progress text
│   │   │   ├── AuditPanel.jsx          # Audit trail side panel (fullscreen only)
│   │   │   ├── PanelMode.jsx           # FAB + anchored card layout
│   │   │   ├── SidepanelMode.jsx       # Full-height drawer layout
│   │   │   └── FullscreenMode.jsx      # Fill-parent layout
│   │   ├── assistant/
│   │   │   └── AssistantMessage.jsx    # Assistant bubble + renderer dispatch
│   │   └── user/
│   │       └── UserMessage.jsx         # User bubble
│   ├── context/
│   │   ├── ConvEngineChatContext.jsx   # Provider: resolvedConfig, apiClient, streamClient, chatState
│   │   └── ChatActionsContext.jsx      # submit / submitSilent / appendBubble / prefillInput
│   ├── hooks/
│   │   ├── useChat.js                  # Core send logic + stream subscription
│   │   ├── useIcons.js                 # Icon resolution (built-ins + consumer overrides)
│   │   └── useTheme.js                 # Dark/light mode toggle state
│   ├── icons/
│   │   └── Icons.jsx                   # All built-in SVG icon components
│   ├── renderers/
│   │   ├── core/
│   │   │   └── RendererRegistry.jsx    # Priority-sorted renderer dispatch
│   │   └── providers/
│   │       ├── DefaultRenderer.jsx     # Plain-text / markdown fallback
│   │       ├── FaqAnswerRenderer.jsx   # Built-in FAQ card renderer
│   │       └── index.js                # Built-in provider array export
│   ├── styles/
│   │   └── convengine-chat.css         # All styles — scoped to .ce-chat-root
│   └── utils/
│       ├── assistantContent.js         # Markdown parsing helpers
│       ├── messageBubble.js            # Bubble shape / error detection
│       ├── messagePayload.js           # Payload stringify + engine status extraction
│       └── uuid.js                     # createClientId — nanoid-style client UUID
├── vite.config.js                      # Library build config (ES + UMD, CSS extraction)
├── tailwind.config.js                  # Tailwind — content-scanned for CSS purge
├── package.json
├── index.d.ts                          # TypeScript declarations for consumers
├── README.md                           # Consumer-facing documentation
└── AGENT.md                            # This file — maintainer architecture reference
```

---

## State management

All chat state is stored in `ConvEngineChatContext` rather than inside individual mode components. This is intentional: when the user switches mode (panel → sidepanel → fullscreen), the component tree changes but the context provider stays mounted, so the conversation history, typing state, and stream subscription are all preserved.

```
ConvEngineChatProvider (ConvEngineChatContext.jsx)
│
├── conversationId     stable — generated once (createClientId) or provided by consumer
├── apiClient          memoized REST client; recreated only when apiHost / apiEndpoints changes
├── streamClient       memoized stream client; null when stream.enabled is false;
│                      recreated when streamEnabled, apiHost, or stream config changes
├── resolvedConfig     memoized config object with all defaults applied
│
└── chatState          shared state object passed through context to all mode components
    ├── messages        array of { id, role, text, type, ... }
    ├── input           current composer text (string)
    ├── isTyping        true while awaiting backend response
    ├── progressText    current VERBOSE stream step shown in typing indicator
    ├── auditRevision   integer incremented on every stream event (triggers AuditPanel refetch)
    ├── threadRef       ref to scrollable message container
    └── inputRef        ref to composer <input>
```

---

## API client (`src/api/client.js`)

`createApiClient(apiHost, apiEndpoints)` returns an object with three async methods:

| Method | HTTP | Default path |
|--------|------|--------------|
| `sendMessage(conversationId, message, inputParams, reset)` | POST | `{apiHost}/api/v1/conversation/message` |
| `submitFeedback({ conversationId, feedbackType, messageId, assistantResponse, metadata })` | POST | `{apiHost}/api/v1/conversation/feedback` |
| `getAudit(conversationId)` | GET | `{apiHost}/api/v1/conversation/audit/{conversationId}` |

Individual paths can be overridden via `apiEndpoints`. If an override value starts with `http` it is used verbatim (full URL). If it starts with `/` it is resolved against the current browser origin, ignoring `apiHost`.

---

## Streaming architecture (`src/api/stream.js`)

### Factory

`createStreamClient(apiHost, streamConfig)` returns `{ subscribe(conversationId, handlers) }`.

- `streamConfig.transport` — `'sse'` (default) or `'stomp'`
- `streamConfig.wsBase` — STOMP only; base URL for the SockJS endpoint; defaults to `apiHost`

Calling `subscribe` opens the transport connection and returns `{ close() }`.

---

### SSE transport

Opens a native browser `EventSource` to:

```
GET {apiHost}/api/v1/conversation/stream/{conversationId}
```

The library calls `source.addEventListener(stage, handler)` for every name in `STREAM_STAGE_EVENTS` (listed below). Unnamed `message` events are dispatched as stage `"MESSAGE"`.

Each event calls `handlers.onEvent({ stage, data, raw })`:
- `stage` — the SSE event name string (e.g. `"VERBOSE"`, `"ENGINE_RETURN"`)
- `data`  — parsed JSON payload object, or `null` if the data is empty / unparseable
- `raw`   — the original `MessageEvent` from EventSource

---

### STOMP transport

Uses `globalThis.StompJs.Client` and `globalThis.SockJS`. Both must be installed by the consumer and exposed on `globalThis` before the widget mounts.

```js
// app entry (e.g. main.jsx or layout.jsx)
import StompJs from '@stomp/stompjs';
import SockJS  from 'sockjs-client';
globalThis.StompJs = StompJs;
globalThis.SockJS  = SockJS;
```

| Detail | Value |
|--------|-------|
| SockJS endpoint | `{wsBase}/ws-convengine` |
| STOMP subscription | `/topic/convengine/audit/{conversationId}` |
| Reconnect delay | 5 000 ms |

If either global is absent at subscribe time, the library logs a console warning and returns a no-op `{ close() {} }` handle — it never throws.

---

### Recognised stage event names

```
CONNECTED               USER_INPUT
DIALOGUE_ACT_LLM_INPUT  DIALOGUE_ACT_LLM_OUTPUT
STEP_ENTER              STEP_EXIT              STEP_ERROR
ASSISTANT_OUTPUT        ENGINE_RETURN
MCP_TOOL_CALL           MCP_TOOL_RESULT        MCP_TOOL_ERROR        MCP_FINAL_ANSWER
TOOL_ORCHESTRATION_REQUEST   TOOL_ORCHESTRATION_RESULT   TOOL_ORCHESTRATION_ERROR
RULE_MATCH              RULE_APPLIED           RULE_NO_MATCH
PENDING_ACTION_EXECUTED PENDING_ACTION_REJECTED PENDING_ACTION_FAILED
CORRECTION_STEP_RETRY_REQUESTED
POLICY_BLOCK
VERBOSE
```

---

### Stream lifecycle in `useChat.js`

The `useChat` hook subscribes to `streamClient` inside a `useEffect` keyed on `[streamClient, conversationId]`. The subscription is closed and all timers cleared on effect cleanup.

```
streamClient.subscribe(conversationId, {
  onConnected → setAuditRevision(v + 1)

  onEvent     → setAuditRevision(v + 1)        // every event bumps audit revision
              → if VERBOSE:
                    extract text from event data
                    applyProgressText(text)      // throttled — see below
              → if ASSISTANT_OUTPUT or ENGINE_RETURN:
                    clearProgressTextSmoothly()

  onError     → no-op (connection errors are silently ignored)
})
```

---

### Progress text throttling (`MIN_PROGRESS_VISIBLE_MS = 9000`)

A progress step is displayed for a minimum of **9 000 ms** before it can be replaced, preventing flicker when multiple `VERBOSE` events arrive in rapid succession.

**`applyProgressText(text)`**
- If no text is currently shown → display immediately, record timestamp.
- If the same text is already shown → no-op.
- If different text and elapsed time ≥ 9 000 ms → swap immediately.
- If elapsed time < 9 000 ms → queue the new text and schedule a timer for the remaining gap.

**`clearProgressTextSmoothly()`**
- Cancels any queued text.
- If elapsed time ≥ 9 000 ms → clears synchronously.
- Otherwise → schedules clearing after the remaining minimum time via `clearTimerRef`.

Both timers (`progressTimerRef`, `clearTimerRef`) are cleared in the effect cleanup.

---

### VERBOSE payload extraction (`extractVerboseText`)

Reads the event `data` object in this precedence order:

| Priority | Path |
|----------|------|
| 1 | `data.verbose.text` |
| 2 | `data.verbose.message` |
| 3 | `data.verbose.errorMessage` |
| 4 | `data.payload.verbose.text` |
| 5 | `data.payload.verbose.message` |
| 6 | `data.payload.verbose.errorMessage` |

Returns `""` when no matching field is found.

---

### Transport badge

When `config.showTransportBadge: true`, a `<span>` with class `ce-transport-badge ce-transport-badge--{transport}` is rendered inside the header brand area (after the title).

The transport string is derived at render time:

```
stream.enabled === false  →  "rest"
stream.transport === 'sse'   →  "sse"
stream.transport === 'stomp' →  "stomp"
```

CSS:
- `.ce-transport-badge--rest` — gray chip (`--ce-bg-chip` background, `--ce-text-secondary` text)
- `.ce-transport-badge--sse` / `.ce-transport-badge--stomp` — green (`#dcfce7` bg, `#15803d` text)
- Dark-mode overrides applied via `[data-ce-theme=dark]` attribute selector

---

## Renderer system (`src/renderers/`)

Assistant message rendering uses a priority-sorted provider chain.

```js
// Provider shape
{
  key:      'MyRenderer',
  priority: 200,                        // higher = evaluated first; built-ins run at 100
  match:    (ctx) => boolean,           // return true to claim this message
  Component({ payload, actions }) {}    // React component rendered in the assistant bubble
}
```

`resolveAssistantRenderer(ctx, providers)` sorts providers by priority (descending), finds the first with a truthy `match(ctx)`, and returns its `Component`. Falls back to `DefaultRenderer` when nothing matches.

`ctx` object passed to both `match` and `Component`:

| Key | Type | Description |
|-----|------|-------------|
| `effectiveType` | `string` | Renderer type key extracted from the API response payload |
| `payload` | `object` | Full response payload from the backend |
| `actions` | `ChatActions` | `submit`, `submitSilent`, `appendBubble`, `prefillInput` |

---

## Message enrichment

> **⚠️ Breaking change in v1.0.8.** `config.messageEnrichment` was redesigned: `mode` ('none'|'text'|'json') is removed, `postfix`→`suffix`, `props`→`inputParams` (now always merged in, not gated behind `'json'` mode). See the [README Breaking Changes section](README.md#breaking-changes-v108) for the migration table.

Before a message is sent, `buildEnrichedPayload(userText, enrichment, existingParams)` transforms it based on `config.messageEnrichment`. There is no `mode` switch — every field is independently optional and they combine freely:

```js
messageEnrichment: {
  prefix: '/faq',            // optional — prepended to outgoing text
  suffix: 'thanks',          // optional — appended to outgoing text
  inputParams: { userId },   // optional — merged into every request's inputParams
  preHook:  [fn1, fn2],      // optional — run sequentially before send
  postHook: [fn1, fn2],      // optional — run sequentially after the response arrives
},
```

| Field | Effect |
|---|---|
| `prefix` / `suffix` | Wraps the outgoing message string: `"{prefix} {userText} {suffix}"`. The user bubble always shows the original typed/display text — wrapping is invisible in the UI. |
| `inputParams` | Merged into every request's `inputParams` (`{ ...enrichment.inputParams, ...rendererParams }`). Renderer-supplied `inputParams` (from `actions.submit`/`actions.submitSilent`) win on key collision. Since `config` is read fresh on every send, a dynamic value here (e.g. driven by React state) updates on the very next message with no per-call plumbing. |
| `preHook` | Array of `(ctx: { userText, inputParams }) => void \| Partial<ctx> \| Promise<...>`, run sequentially (awaited) right before the API call. A hook may return a partial object to shallow-merge into the context passed to the next hook / the final request. |
| `postHook` | Array of `(ctx: { userText, inputParams, response }) => void \| Promise<void>`, run sequentially (awaited) after the backend responds. Side-effect only (analytics, logging) — return values are ignored. |

Enrichment applies uniformly across all three send paths — the composer (`sendMessage`), `actions.submit` (`submitFromRenderer`), and `actions.submitSilent`.

For visibility into every submit — including the plain-text composer flow, which the default renderer doesn't otherwise expose `actions` to — use `config.onSubmit`:

```js
onSubmit: ({ userText, apiText, inputParams }) => { /* ... */ },
onFeedback: ({ conversationId, messageId, feedbackType, assistantResponse }) => { /* ... */ },
```

`onSubmit` fires right before every request (composer, renderer submit, and silent submit alike) with the fully-enriched payload. `onFeedback` fires on the same "before the request" timing, right before 👍/👎 feedback is sent to the backend.

---

## CSS scoping

All styles are scoped to `.ce-chat-root`, applied to the outermost container rendered by `ConvEngineChat`. Dark mode is toggled by setting the `data-ce-theme="dark"` attribute on `.ce-chat-root`. All dark-mode overrides use `[data-ce-theme=dark]` attribute selectors.

CSS custom properties on `.ce-chat-root` control all dynamic values. Consumers override tokens via the `theme` prop on `<ConvEngineChat>` — keys are either full `--ce-*` names or shorthand keys (auto-prefixed with `--ce-`).

---

## Build

```bash
npm run build
```

Vite library-mode outputs:
- `dist/convengine-chat.es.js` — ES module (tree-shakable, primary)
- `dist/convengine-chat.umd.cjs` — UMD bundle (CommonJS fallback)
- `dist/convengine-chat.css` — extracted stylesheet
- `dist/*.map` — source maps

Only `dist/`, `README.md`, and `LICENSE` are published (controlled by `"files"` in `package.json`). `"sideEffects": ["**/*.css"]` prevents bundlers from tree-shaking the stylesheet.

---

## Public API (`src/index.js`)

| Export | Kind | Purpose |
|--------|------|---------|
| `ConvEngineChat` | component | Root public component |
| `ConvEngineChatProvider` | component | Context provider (for advanced wrapping) |
| `useConvEngineChatContext` | hook | Access full context inside the provider tree |
| `useChatActions` | hook | `{ actions: ChatActions }` — submit, submitSilent, appendBubble, prefillInput |
| `useChat` | hook | Core send + stream logic (used internally; exposed for advanced consumers) |
| `useTheme` | hook | Dark/light mode toggle state |
| `useIcons` | hook | Resolved icon components (built-ins merged with consumer overrides) |
| `resolveAssistantRenderer` | function | Renderer dispatch — finds highest-priority matching provider |
| `DefaultRenderer` | component | Plain-text / markdown fallback renderer |
| `builtInRendererProviders` | array | Built-in provider list (FaqAnswer + Default) |
| `parseAssistantSegments` | function | Segment markdown string into text / code / table blocks |
| `containsMarkdownTable` | function | Returns true if a string contains a markdown table |
| `prettifyHeader` | function | Title-case a header string |
| `bubbleShapeClass` | function | Returns CSS class for a bubble shape variant |
| `isAssistantErrorBubble` | function | Detects backend error response payloads |
| `stringifyPayload` | function | Stable JSON stringify for response payloads |
| `extractEngineStatus` | function | Pulls engine status label from a response payload |
| `createClientId` | function | Generates a client-side UUID (nanoid-style) |
| `createApiClient` | function | Low-level REST API client factory |

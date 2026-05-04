# @salilvnair/convengine-chat

[![npm](https://img.shields.io/npm/v/@salilvnair/convengine-chat)](https://www.npmjs.com/package/@salilvnair/convengine-chat)
[![license](https://img.shields.io/npm/l/@salilvnair/convengine-chat)](./LICENSE)

> A zero-dependency React chat widget for the **ConvEngine** conversational AI framework.  
> Drop it into any React or Next.js app in minutes — no build config, no boilerplate.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Modes](#modes)
- [Component Props](#component-props)
- [config Object](#config-object)
- [Backend Routes](#backend-routes)
- [Color Theming](#color-theming)
- [Theme Tokens](#theme-tokens)
- [Custom Icons](#custom-icons)
- [Custom Renderers](#custom-renderers)
- [Actions API](#actions-api)
- [Hooks](#hooks)
- [Publishing to npm (Developer Guide)](#publishing-to-npm)

---

## Installation

```bash
npm install @salilvnair/convengine-chat
# or
yarn add @salilvnair/convengine-chat
```

**Requirements:** React 18+ and react-dom. Both are peer dependencies — the library ships no copy of React itself.

### Import the stylesheet

Import once in your app entry file (e.g. `layout.jsx`, `main.jsx`, or `_app.jsx`) as a **JS import** — not a CSS `@import`:

```jsx
// app/layout.jsx
import '@salilvnair/convengine-chat/style.css';
```

> **Next.js tip:** Use a JS `import` (in a `.jsx`/`.tsx` file), not a CSS `@import` inside `globals.css`. Next.js resolves package paths in JS imports through the `exports` map; CSS `@import` does not reliably resolve scoped npm packages.

### Next.js setup

> **Only required when using a local `file:` path during development.**  
> Not required for the npm-published version.

```js
// next.config.mjs
const nextConfig = {
  transpilePackages: ['@salilvnair/convengine-chat'],
};
export default nextConfig;
```

**Why it's needed locally but not after publishing:**

| Scenario | Why |
|---|---|
| Local `file:` symlink | The symlink resolves the entire package folder, so Next.js webpack can reach the raw `src/*.jsx` files (not just `dist/`). Next.js doesn't transpile `node_modules` by default, so it chokes on untranspiled JSX. `transpilePackages` tells Next.js to run SWC over it. |
| Published npm package | Only `dist/`, `README.md` and `LICENSE` are shipped (controlled by `"files"` in `package.json`). `node_modules/@salilvnair/convengine-chat` contains only pre-built JS and CSS — no JSX, no raw source, no transpilation needed. |

The one exception: if you ever change the package to ship raw ESM source (removing the build step and pointing `exports` at `./src/index.jsx`), consumers would need `transpilePackages` again. With the current Vite build setup this is not required.

---

## Quick Start

The shortest possible usage:

```jsx
import { ConvEngineChat } from '@salilvnair/convengine-chat';
import '@salilvnair/convengine-chat/style.css';

export default function App() {
  return (
    <ConvEngineChat
      mode="panel"
      config={{ apiHost: 'http://localhost:8080' }}
    />
  );
}
```

Full reference with every option (delete what you don't need — all defaults are applied automatically):

```jsx
import { ConvEngineChat, useChatActions } from '@salilvnair/convengine-chat';
import '@salilvnair/convengine-chat/style.css';

// Optional: custom icon component
// Use className="ce-icon" — omit width/height so CSS controls the size.
function MyFabIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor"
      className="ce-icon" aria-hidden="true" {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12
               17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

// Optional: custom renderer provider
const myRenderer = {
  key:      'MyCard',
  priority: 200,                                    // > 100 runs before built-ins
  match:    (ctx) => ctx.effectiveType === 'MyCard',
  Component({ payload, actions }) {
    return (
      <button
        className="ce-interactive-submit"
        onClick={() => actions.submit(payload.label, { choice: payload.value })}
      >
        {payload.label}
      </button>
    );
  },
};

<ConvEngineChat
  mode="panel"           // "panel" | "sidepanel" | "fullscreen"
  position="bottom"      // "bottom" | "top"  — FAB vertical anchor (panel only)
  align="right"          // "right"  | "left" — FAB / sidepanel horizontal anchor
  onModeChange={(newMode) => console.log('mode →', newMode)}

  config={{
    // ── Backend ──────────────────────────────────────────────────────────
    apiHost:        'http://localhost:8080',
    conversationId: undefined,           // resume an existing conversation

    // ── Text & Labels ─────────────────────────────────────────────────────
    title:       'ConvEngine Assistant',
    subtitle:    "Ask me anything — I'll do my best to help.",
    placeholder: 'Ask ConvEngine…',

    // ── Visibility flags ──────────────────────────────────────────────────
    showFeedback:          true,    // 👍👎 row under every AI message
    showAudit:             false,   // audit trail side panel (fullscreen only)
    showDarkModeLightMode: false,   // 🌙/☀️ toggle in header
    showHeaderDot:         true,    // pulsing dot next to header title
    showLandingAvatar:     true,    // bot avatar on landing screen
    showLandingSubtitle:   true,    // subtitle on landing screen
    showNewChat:           true,    // "New Chat" button (panel + fullscreen)
    showLayoutPicker:      true,    // mode-picker button (panel only)
    showMaximize:          true,    // expand-to-fullscreen button (panel only)
    showMinimize:          true,    // minimize button (panel only)

    // ── Appearance ────────────────────────────────────────────────────────
    defaultDark:    false,          // open in dark mode on first render
    composerShape: 'round',         // "round" (pill) | "rect" (rounded rectangle)

    // ── Color overrides (shorthand; see Color Theming below) ──────────────
    // Each accepts a plain string or { light: '...', dark: '...' } object.
    bubbleUserBg:    undefined,
    bubbleUserText:  undefined,
    bubbleAgentBg:   undefined,
    bubbleAgentText: undefined,
    panelBg:         undefined,
    composerBg:      undefined,
    iconColor:       undefined,     // resting color of header icon buttons

    // ── Custom icons ──────────────────────────────────────────────────────
    icons: {
      ChatBubbleIcon: MyFabIcon,    // FAB open button
      // AgentIcon, UserIcon, SendIcon, ThumbUpIcon, ThumbDownIcon …
    },

    // ── Custom renderers ──────────────────────────────────────────────────
    renderers: [myRenderer],

    // ── Lifecycle callbacks ───────────────────────────────────────────────
    onMessage:  (text) => console.log('user sent:', text),
    onResponse: (text) => console.log('AI replied:', text),
  }}

  // ── CSS token overrides (auto-prefixed with --ce-) ────────────────────
  theme={{
    'color-accent':    '#6366f1',
    'panel-width':     '460px',
    'panel-height':    '740px',
    'sidepanel-width': '400px',
    'font-family':     '"Inter", sans-serif',
  }}
/>
```

---

## Modes

| mode | Description |
|---|---|
| `"panel"` | Floating FAB button that opens a card. Supports minimize, maximize, and mode-switching. |
| `"sidepanel"` | Full-height drawer attached to the left or right edge. Use `align="left"` or `align="right"`. |
| `"fullscreen"` | Fills its parent container entirely. Wrap in a `100vh` div for a full-page experience. |

```jsx
// Panel (default)
<ConvEngineChat mode="panel" align="right" config={{ apiHost: '...' }} />

// Side drawer
<ConvEngineChat mode="sidepanel" align="right" config={{ apiHost: '...' }} />

// Fills parent
<div style={{ height: '100vh' }}>
  <ConvEngineChat mode="fullscreen" config={{ apiHost: '...' }} />
</div>
```

---

## Component Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `mode` | `"panel" \| "sidepanel" \| "fullscreen"` | `"panel"` | Rendering mode. |
| `position` | `"bottom" \| "top"` | `"bottom"` | Vertical FAB anchor (panel mode only). |
| `align` | `"right" \| "left"` | `"right"` | Horizontal FAB anchor / sidepanel side. |
| `config` | `object` | `{}` | Configuration bag — see [config Object](#config-object). |
| `theme` | `object` | `{}` | CSS custom-property overrides, auto-prefixed with `--ce-`. |
| `onModeChange` | `function` | `undefined` | Called with the new mode string when the user switches mode from the header picker. |

---

## config Object

### Backend

| Key | Type | Default | Description |
|---|---|---|---|
| `apiHost` | `string` | `""` | Base URL of your backend. Omit (or pass `""`) for same-origin servers. Pass `"http://localhost:8080"` for a separate backend. Must have CORS enabled when cross-origin. |
| `conversationId` | `string` | `undefined` | Resume an existing conversation by ID. |
| `apiEndpoints` | `object` | `undefined` | Override individual endpoint paths. See [Backend Routes](#backend-routes). |

### Text & Labels

| Key | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"ConvEngine Assistant"` | Header title and landing screen heading. |
| `subtitle` | `string` | `"Ask me anything — I'll do my best to help."` | Landing screen subtitle shown below the title. |
| `placeholder` | `string` | `"Ask ConvEngine…"` | Composer input placeholder text. |

### Visibility Flags

| Key | Type | Default | Applicable modes |
|---|---|---|---|
| `showFeedback` | `boolean` | `true` | panel, sidepanel, fullscreen |
| `showAudit` | `boolean` | `false` | fullscreen |
| `showDarkModeLightMode` | `boolean` | `false` | panel, sidepanel, fullscreen |
| `showHeaderDot` | `boolean` | `true` | panel, sidepanel, fullscreen |
| `showLandingAvatar` | `boolean` | `true` | panel, sidepanel, fullscreen |
| `showLandingSubtitle` | `boolean` | `true` | panel, sidepanel, fullscreen |
| `showNewChat` | `boolean` | `true` | panel, fullscreen |
| `showLayoutPicker` | `boolean` | `true` | panel |
| `showMaximize` | `boolean` | `true` | panel |
| `showMinimize` | `boolean` | `true` | panel |

### Appearance

| Key | Type | Default | Description |
|---|---|---|---|
| `defaultDark` | `boolean` | `false` | Open in dark mode on first render. |
| `composerShape` | `"round" \| "rect"` | `"round"` | Pill (round) or rounded-rectangle (rect) composer input. |

### Color Overrides

Each key accepts a plain `string` or a `{ light: string, dark: string }` object.  
See [Color Theming](#color-theming) for full documentation.

| Key | Overrides CSS var | What it colors |
|---|---|---|
| `bubbleUserBg` | `--ce-bg-bubble-user` | User message bubble fill (hex, rgba, or gradient) |
| `bubbleUserText` | `--ce-text-bubble-user` | User message bubble text |
| `bubbleAgentBg` | `--ce-bg-bubble-agent` | Assistant message bubble fill |
| `bubbleAgentText` | `--ce-text-bubble-agent` | Assistant message bubble text |
| `panelBg` | `--ce-bg-panel` | Chat panel / sidepanel background |
| `composerBg` | `--ce-bg-composer` | Composer (input area) background |
| `iconColor` | `--ce-icon-color` | Resting color of header icon buttons (hover always shows accent) |

### Callbacks

| Key | Type | Description |
|---|---|---|
| `onMessage` | `(text: string) => void` | Fired when the user sends a message. |
| `onResponse` | `(text: string) => void` | Fired when an assistant response arrives. |

---

## Backend Routes

ConvEngine Chat calls three endpoints. The table below shows the **default paths** used when you don't pass `apiEndpoints`:

| Endpoint | Method | Default path | Purpose |
|---|---|---|---|
| message | `POST` | `/api/v1/conversation/message` | Send a user message, receive assistant response |
| feedback | `POST` | `/api/v1/conversation/feedback` | Submit 👍 / 👎 feedback on a message |
| audit | `GET` | `/api/v1/conversation/audit/:conversationId` | Fetch the full conversation audit trail |

### Request bodies

**`POST /api/v1/conversation/message`**
```json
{
  "conversationId": "abc-123",
  "message": "I want to know about the pro plan",
  "reset": false,
  "inputParams": {}
}
```

**`POST /api/v1/conversation/feedback`**
```json
{
  "conversationId": "abc-123",
  "feedbackType": "thumbsUp",
  "messageId": "msg-456",
  "assistantResponse": "...",
  "metadata": { "role": "assistant", "hasMarkdownTable": false }
}
```

### Same-origin server (Express / Hapi / Fastify)

When the chat widget and your API are served from the **same origin**, omit `apiHost` entirely:

```js
// Express — default paths
app.post('/api/v1/conversation/message',  messageHandler);
app.post('/api/v1/conversation/feedback', feedbackHandler);
app.get( '/api/v1/conversation/audit/:conversationId', auditHandler);
```

```jsx
// No apiHost needed — defaults to same origin
<ConvEngineChat config={{}} />
```

### Customise route paths with `apiEndpoints`

If your server uses different paths, override them individually. You only need to specify the ones that differ — unspecified endpoints keep their defaults.

```js
// Express — custom paths
app.post('/api/v1/message',  messageHandler);
app.post('/api/v1/feedback', feedbackHandler);
app.get( '/api/v1/audit/:conversationId', auditHandler);
```

```jsx
<ConvEngineChat
  config={{
    apiEndpoints: {
      message:  '/api/v1/message',
      feedback: '/api/v1/feedback',
      audit:    '/api/v1/audit',    // /:conversationId appended automatically
    },
  }}
/>
```

### Cross-origin backend with custom paths

```jsx
<ConvEngineChat
  config={{
    apiHost: 'http://localhost:8080',
    apiEndpoints: {
      message: 'http://localhost:8080/api/v1/message',
    },
  }}
/>
```

> When an `apiEndpoints` value starts with `http` it is used as-is (full URL). When it starts with `/` it is treated as a path on the same origin regardless of `apiHost`.

---

## Color Theming

Every color config prop accepts **two shapes**:

```jsx
// Shape 1: plain string — same value in both light and dark mode
bubbleUserBg: "#6366f1"

// Shape 2: per-theme object — different value per mode
bubbleUserBg: { light: "#6366f1", dark: "#1e3a5f" }
```

ConvEngine reads the active theme at render time and automatically picks the right variant — just like iOS Color Assets.  
Fallback resolution order: `dark ?? light` in dark mode, `light ?? dark` in light mode, then the built-in CSS token default.

### Example 1 — Plain string

```jsx
<ConvEngineChat
  config={{
    bubbleUserBg:   "#6366f1",
    bubbleUserText: "#ffffff",
    bubbleAgentBg:  "#f1f5f9",
  }}
/>
```

### Example 2 — Per-theme object

```jsx
<ConvEngineChat
  config={{
    bubbleUserBg: {
      light: "#6366f1",
      dark:  "#1e3a5f",
    },
    bubbleAgentBg: {
      light: "#f1f5f9",
      dark:  "#2b2b2b",
    },
    panelBg: {
      light: "#ffffff",
      dark:  "#1a1a1a",
    },
    composerBg: {
      light: "#f8fafc",
      dark:  "#212121",
    },
  }}
/>
```

### Example 3 — Gradient (dark mode glass effect)

Any valid CSS `background` value works — including `linear-gradient` and `radial-gradient`.

```jsx
<ConvEngineChat
  config={{
    bubbleUserBg: {
      light: "#6366f1",
      dark:  "linear-gradient(90deg, rgba(37,99,235,0.55) 0%, rgba(96,165,250,0.38) 100%)",
    },
  }}
/>
```

### Example 4 — Seed initial dark mode

```jsx
<ConvEngineChat
  config={{
    defaultDark:           true,   // opens in dark mode
    showDarkModeLightMode: true,   // user can toggle back
    bubbleUserBg: {
      light: "#6366f1",
      dark:  "linear-gradient(90deg, rgba(37,99,235,0.55) 0%, rgba(96,165,250,0.38) 100%)",
    },
  }}
/>
```

### Example 5 — Custom icon resting color

```jsx
<ConvEngineChat
  config={{
    iconColor: {
      light: "#6366f1",   // icons match your brand in light mode
      dark:  "#818cf8",   // softer indigo in dark mode
    },
  }}
/>
```

---

## Theme Tokens

All visual tokens are CSS custom properties on `.ce-chat-root`. Pass shorthand keys (auto-prefixed `--ce-`) or full variable names to the `theme` prop:

```jsx
<ConvEngineChat
  theme={{
    'color-accent':       '#6366f1',   // → --ce-color-accent
    'color-accent-hover': '#4f46e5',
    'panel-width':        '480px',
    'panel-height':       '700px',
    'sidepanel-width':    '420px',
    'font-family':        '"Inter", sans-serif',
    '--ce-bg-panel':      '#0f172a',   // full name also works
  }}
/>
```

| Token | Default | Description |
|---|---|---|
| `--ce-color-accent` | `#6366f1` | Primary accent — FAB, buttons, highlights |
| `--ce-color-accent-hover` | auto-derived | Accent hover state (darkened) |
| `--ce-icon-color` | `#64748b` | Resting color of header icon buttons |
| `--ce-panel-width` | `460px` | Width of the floating panel |
| `--ce-panel-height` | `740px` | Max-height of the floating panel |
| `--ce-sidepanel-width` | `400px` | Width of the side drawer |
| `--ce-bg-panel` | `#ffffff` | Panel / sidepanel background |
| `--ce-bg-bubble-user` | `#6366f1` | User message bubble fill |
| `--ce-bg-bubble-agent` | `#f1f5f9` | Assistant message bubble fill |
| `--ce-font-family` | system-ui | Font stack inside the widget |

---

## Custom Icons

Pass any React component to override a built-in icon. Always use `className="ce-icon"` and omit `width`/`height` — the library controls sizing via CSS.

| Slot key | Where it appears | Fill mode |
|---|---|---|
| `LandingAvatarIcon` | Bot avatar on the landing screen | stroked |
| `ChatBubbleIcon` | FAB open button | filled |
| `AgentIcon` | Avatar next to every assistant message | stroked |
| `UserIcon` | Avatar next to every user message | stroked |
| `SendIcon` | Send button inside the composer | filled |
| `ThumbUpIcon` | Feedback row below AI messages | stroked |
| `ThumbDownIcon` | Feedback row below AI messages | stroked |
| `CloseIcon` | Panel close button | stroked |
| `MinimizeIcon` | Panel minimize button | stroked |
| `MaximizeIcon` | Panel expand-to-fullscreen button | stroked |
| `RestoreIcon` | Panel restore from fullscreen | stroked |
| `RestoreFromMinIcon` | Panel restore from minimized | stroked |
| `SunIcon` | Light mode toggle (visible in dark mode) | stroked |
| `MoonIcon` | Dark mode toggle (visible in light mode) | stroked |
| `AuditIcon` | Audit trail toggle button | stroked |
| `NewChatIcon` | New chat button | stroked |
| `LayoutIcon` | Mode picker button | stroked |
| `PopoutIcon` | Popout button | stroked |
| `PanelLeftIcon` | Mode picker → left sidepanel | stroked |
| `PanelRightIcon` | Mode picker → right sidepanel | stroked |

```jsx
function StarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor"
      className="ce-icon" aria-hidden="true" {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77
               l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

<ConvEngineChat
  config={{
    apiHost: 'http://localhost:8080',
    icons: {
      ChatBubbleIcon: StarIcon,
      // Override only what you need — all others keep their defaults
    },
  }}
/>
```

---

## Custom Renderers

Intercept assistant messages and render rich, interactive UI in place of plain text.

Providers are sorted by `priority` (highest wins). Built-ins run at priority 100.

```jsx
// SelectionRenderer.jsx
import { useState } from 'react';

export function SelectionRenderer({ payload, actions }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="ce-interactive-card">
      <p>{payload.question}</p>
      {payload.options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            value={o.value}
            checked={selected === o.value}
            onChange={() => setSelected(o.value)}
          />
          {o.label}
        </label>
      ))}
      <button
        disabled={!selected}
        onClick={() => actions.submit(selected, { choice: selected })}
        className="ce-interactive-submit"
      >
        Continue →
      </button>
    </div>
  );
}

// Register it
const myProvider = {
  key:      'SelectionPrompt',
  priority: 200,
  match:    (ctx) => ctx.effectiveType === 'SelectionPrompt',
  Component: SelectionRenderer,
};

<ConvEngineChat
  config={{
    apiHost: 'http://localhost:8080',
    renderers: [myProvider],
  }}
/>
```

---

## Actions API

Injected as `props.actions` into every renderer `Component`, and also available via `useChatActions()`.

```ts
interface ChatActions {
  /** Add a user bubble and send the message to the ConvEngine backend */
  submit(displayText: string, inputParams?: object): void;

  /** Send inputParams to the backend silently — no user bubble shown */
  submitSilent(inputParams: object): void;

  /** Inject a bubble into the conversation without an API call */
  appendBubble(text: string, role?: 'user' | 'assistant'): void;

  /** Pre-populate the composer — user reviews and sends manually */
  prefillInput(text: string): void;
}
```

---

## Hooks

### `useChatActions`

Access chat actions from any component rendered **inside** `<ConvEngineChat>` (i.e. inside a custom renderer):

```jsx
import { useChatActions } from '@salilvnair/convengine-chat';

function HelpButton() {
  const { actions } = useChatActions();
  return (
    <button
      className="ce-interactive-submit"
      onClick={() => actions.submitSilent({ intent: 'help' })}
    >
      Get Help
    </button>
  );
}
```

> `useChatActions` throws if called outside the ConvEngine context tree.

---

---

## Publishing to npm

> This section is for **library developers** — contributors who maintain and publish `@salilvnair/convengine-chat` itself.

### Prerequisites

1. Node.js 18+ and npm 9+
2. An npm account with publish access to the `@salilvnair` scope on npm
3. Logged in to the npm registry: `npm login`

---

### Step 1 — Confirm the package name

The package is published under the scoped name `@salilvnair/convengine-chat`. Confirm `package.json` shows:

```json
{
  "name": "@salilvnair/convengine-chat",
  "license": "MIT"
}
```

Check the current published version (if any): `npm view @salilvnair/convengine-chat`

---

### Step 2 — Update the version

Follow [Semantic Versioning](https://semver.org/):

| Change type | Command | Example |
|---|---|---|
| Bug fix | `npm version patch` | `0.1.0` → `0.1.1` |
| New feature (backward-compatible) | `npm version minor` | `0.1.0` → `0.2.0` |
| Breaking change | `npm version major` | `0.1.0` → `1.0.0` |

This automatically:
- Bumps `package.json` version
- Creates a git tag `vX.Y.Z`
- Commits the change

---

### Step 3 — Run the build

The package ships only the compiled `dist/` output — no raw JSX source. Always rebuild before publishing:

```bash
npm run build
```

Verify the output files exist:

```bash
ls dist/
# convengine-chat.es.js
# convengine-chat.umd.cjs
# convengine-chat.css
# *.map files
```

---

### Step 4 — Verify what will be published

Check exactly which files will be included without actually publishing:

```bash
npm pack --dry-run
```

You should see only:
- `dist/convengine-chat.es.js`
- `dist/convengine-chat.umd.cjs`
- `dist/convengine-chat.css`
- `dist/*.map`
- `README.md`
- `package.json`

If extra source files appear, audit the `"files"` field in `package.json`:

```json
"files": [
  "dist",
  "README.md",
  "LICENSE"
]
```

---

### Step 5 — Test the tarball locally

Before publishing, install the tarball in `convengine-chat-demo` to verify it works end-to-end:

```bash
# In convengine-chat/
npm pack
# Creates salilvnair-convengine-chat-1.x.x.tgz

# In convengine-chat-demo/
npm install ../convengine-chat/salilvnair-convengine-chat-1.x.x.tgz
npm run dev
# Verify the demo works correctly with the tarball build
```

---

### Step 6 — Publish

`@salilvnair/convengine-chat` is a **scoped package**. Scoped packages default to private on npm, so `--access public` is always required:

```bash
npm publish --access public
```

#### Dry run first (rehearsal — nothing is uploaded)

```bash
npm publish --dry-run --access public
```

---

### Step 7 — Push git tags

`npm version` created a tag locally. Push it to the remote:

```bash
git push && git push --tags
```

---

### Step 8 — Verify the published package

```bash
npm view @salilvnair/convengine-chat
# or
npm view @salilvnair/convengine-chat versions --json
```

Install in a fresh project to confirm everything works:

```bash
mkdir /tmp/ce-test && cd /tmp/ce-test
npm init -y
npm install react react-dom @salilvnair/convengine-chat
```

---

### Pre-release / beta publishing

For beta or RC releases without affecting the `latest` tag:

```bash
npm version prerelease --preid=beta   # → 1.0.1-beta.0
npm publish --access public --tag beta
```

Consumers install it explicitly: `npm install @salilvnair/convengine-chat@beta`

---

### Release checklist

- [ ] `package.json` version bumped with `npm version`
- [ ] `npm run build` succeeds — `dist/` is up to date
- [ ] `npm pack --dry-run` shows only expected files
- [ ] Tested locally with tarball install in demo app
- [ ] CHANGELOG updated (if maintained)
- [ ] `npm publish --access public` completed
- [ ] `git push && git push --tags`
- [ ] `npm view @salilvnair/convengine-chat` shows the new version

---

### Updating peerDependencies

If you ever need to support a wider React version range, update `package.json`:

```json
"peerDependencies": {
  "react":     ">=18.0.0",
  "react-dom": ">=18.0.0"
}
```

---

### Troubleshooting

**`npm publish` says "You do not have permission"**  
→ Run `npm login` and confirm you are authenticated as a user with publish rights to the package.

**`npm publish` says "cannot publish over the previously published versions"**  
→ The version already exists on the registry. Bump the version with `npm version patch` first.

**Consumer gets `Module not found: @salilvnair/convengine-chat`**  
→ Confirm the `"exports"` field in `package.json` is present and `dist/` files exist in the published tarball (`npm pack --dry-run --access public`).

**Consumer's Next.js app errors on raw JSX**  
→ This only happens with a `file:` local symlink (which exposes `src/`). The published npm package ships only `dist/` — no transpilation needed.

**CSS not loading**  
→ Make sure the consumer does `import '@salilvnair/convengine-chat/style.css'` in their app entry. The `"sideEffects": ["**/*.css"]` field in `package.json` prevents bundlers from tree-shaking the stylesheet.
---

## License

MIT © [Salil V Nair](https://github.com/salilvnair)
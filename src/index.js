/**
 * convengine-chat — Public API
 * ─────────────────────────────────────────────────────────────────────────────
 * Import the CSS in your app entry point:
 *   import "convengine-chat/style.css";
 *
 * Then use the component:
 *   import { ConvEngineChat } from "convengine-chat";
 *
 *   <ConvEngineChat mode="panel" position="bottom" align="right" config={{ apiHost: "..." }} />
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Root component ──────────────────────────────────────────────────────────
export { ConvEngineChat } from './components/ConvEngineChat.jsx';

// ── Context & hooks (for advanced consumers / custom wrappers) ──────────────
export {
  ConvEngineChatProvider,
  useConvEngineChatContext,
} from './context/ConvEngineChatContext.jsx';

export { useChatActions } from './context/ChatActionsContext.jsx';

export { useChat }    from './hooks/useChat.js';
export { useTheme }   from './hooks/useTheme.js';
export { useIcons }   from './hooks/useIcons.js';

// ── Renderer extension API ──────────────────────────────────────────────────
export { resolveAssistantRenderer, DefaultRenderer } from './renderers/core/RendererRegistry.jsx';
export { builtInRendererProviders }                  from './renderers/providers/index.js';

// ── Utility exports (useful for building custom renderers) ──────────────────
export { parseAssistantSegments, containsMarkdownTable, prettifyHeader } from './utils/assistantContent.js';
export { bubbleShapeClass, isAssistantErrorBubble }                      from './utils/messageBubble.js';
export { stringifyPayload, extractEngineStatus }                          from './utils/messagePayload.js';
export { createClientId }                                                  from './utils/uuid.js';

// ── Low-level API client factory ────────────────────────────────────────────
export { createApiClient } from './api/client.js';

// ── Icons (consumers can import these as defaults to extend/override) ────────
export {
  UserIcon, AgentIcon, SendIcon, ThumbUpIcon, ThumbDownIcon,
  ChatBubbleIcon, CloseIcon, MinimizeIcon, SunIcon, MoonIcon,
  AuditIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon,
  MaximizeIcon, RestoreIcon, LayoutIcon, NewChatIcon,
  PanelLeftIcon, PanelRightIcon,
  PopoutIcon, RestoreFromMinIcon,
} from './icons/Icons.jsx';

// ── Primitive UI components (for custom layouts) ────────────────────────────
export { ChatComposer }       from './components/core/ChatComposer.jsx';
export { ChatThread }         from './components/core/ChatThread.jsx';
export { ChatHeader }         from './components/core/ChatHeader.jsx';
export { ChatLanding }        from './components/core/ChatLanding.jsx';
export { ChatFeedbackRow }    from './components/core/ChatFeedbackRow.jsx';
export { ChatTypingIndicator } from './components/core/ChatTypingIndicator.jsx';
export { AuditPanel }         from './components/core/AuditPanel.jsx';
export { UserMessage }        from './components/user/UserMessage.jsx';
export { AssistantMessage }   from './components/assistant/AssistantMessage.jsx';

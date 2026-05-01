/**
 * useIcons — merges default library icons with consumer-supplied overrides.
 *
 * Consumers pass an `icons` map in config:
 *   config={{
 *     icons: {
 *       ChatBubbleIcon: MyCustomFabIcon,
 *       SendIcon: MyArrowIcon,
 *     }
 *   }}
 *
 * Every key corresponds to a named icon exported from Icons.jsx.
 * Any key not supplied falls back to the default library icon.
 */
import {
  UserIcon, AgentIcon, SendIcon, ThumbUpIcon, ThumbDownIcon,
  ChatBubbleIcon, CloseIcon, MinimizeIcon, SunIcon, MoonIcon,
  AuditIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon,
  MaximizeIcon, RestoreIcon, LayoutIcon, NewChatIcon,
  PanelLeftIcon, PanelRightIcon, PopoutIcon, RestoreFromMinIcon,
  LandingAvatarIcon,
} from '../icons/Icons.jsx';
import { useConvEngineChatContext } from '../context/ConvEngineChatContext.jsx';

const DEFAULT_ICONS = {
  UserIcon,
  AgentIcon,
  SendIcon,
  ThumbUpIcon,
  ThumbDownIcon,
  ChatBubbleIcon,
  CloseIcon,
  MinimizeIcon,
  SunIcon,
  MoonIcon,
  AuditIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  RestoreIcon,
  LayoutIcon,
  NewChatIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PopoutIcon,
  RestoreFromMinIcon,
  LandingAvatarIcon,
};

export function useIcons() {
  const { config } = useConvEngineChatContext();
  const overrides = config.icons ?? {};
  return { ...DEFAULT_ICONS, ...overrides };
}

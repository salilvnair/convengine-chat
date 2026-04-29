import { createContext, useContext } from 'react';

/**
 * Shape of the `actions` object injected into every renderer Component.
 *
 * actions.submit(displayText, inputParams)
 *   Add a user bubble and POST to the backend.
 *   Pass displayText = '' to skip the visible user bubble.
 *
 * actions.submitSilent(inputParams)
 *   POST to the backend without adding any user bubble.
 *   Shorthand for submit('', inputParams).
 *
 * actions.appendBubble(text, role?)
 *   Add a bubble to the thread client-side only — no API call.
 *   role defaults to 'assistant'. Useful for local validation messages
 *   or step-progress indicators inside a multi-step renderer.
 *
 * actions.prefillInput(text)
 *   Pre-populate the composer input so the user can review/edit before
 *   manually sending. Focuses the input automatically.
 */
const defaultActions = {
  submit:       (_displayText, _inputParams) => {},
  submitSilent: (_inputParams) => {},
  appendBubble: (_text, _role) => {},
  prefillInput: (_text) => {},
};

export const ChatActionsContext = createContext({ actions: defaultActions });

/**
 * Hook for renderer Components — returns { actions }.
 *
 * @example
 * function MyRenderer({ payload }) {
 *   const { actions } = useChatActions();
 *   return <button onClick={() => actions.submit('Yes', { confirmed: true })}>Yes</button>;
 * }
 */
export function useChatActions() {
  return useContext(ChatActionsContext);
}

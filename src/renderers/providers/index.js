import { faqAnswerRendererProvider } from './FaqAnswerRenderer.jsx';

/**
 * The ordered list of built-in renderer providers.
 * Consumers can supply additional providers via `config.renderers`.
 *
 * Provider shape:
 * {
 *   key: string,
 *   priority: number,           // higher = evaluated first
 *   match(ctx): boolean,        // ctx = { rawText, payload, effectiveType }
 *   Component: React.FC,        // receives { payload }
 * }
 */
export const builtInRendererProviders = [
  faqAnswerRendererProvider,
];

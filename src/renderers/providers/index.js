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
 *
 * Built-ins are intentionally empty — all domain renderers (e.g. AnyCustomRenderer)
 * are shipped as opt-in examples and must be wired in via config.renderers.
 */
export const builtInRendererProviders = [];

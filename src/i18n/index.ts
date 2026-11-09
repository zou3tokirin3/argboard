import { ja, type MessageKey, type Messages } from "./ja.ts";

type Placeholders<S extends string> =
  S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;
type Args<K extends MessageKey> = [Placeholders<(typeof ja)[K]>] extends [never]
  ? []
  : [params: Record<Placeholders<(typeof ja)[K]>, string | number>];

/** Partial catalogs are accepted only at this runtime boundary as a safeguard. */
export function createTranslator(
  messages: Partial<Messages>,
  development = false,
) {
  return function translate<K extends MessageKey>(
    key: K,
    ...args: Args<K>
  ): string {
    const message = messages[key];
    if (message === undefined && development) {
      console.warn(`Missing i18n message: ${key}`);
    }
    const params = args[0] as Record<string, string | number> | undefined;
    return (message ?? ja[key]).replace(
      /\{([^{}]+)\}/g,
      (match, name: string) =>
        params && Object.hasOwn(params, name) ? String(params[name]) : match,
    );
  };
}

/** Phase 1 always uses Japanese; no language selection or persistence. */
export const t = createTranslator(ja);

import { en } from "./en.ts";
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

export type Lang = "ja" | "en";

export function langFromSearch(search: string): Lang {
  return new URLSearchParams(search).get("lang") === "en" ? "en" : "ja";
}

/** Read the browser URL once at boot; non-browser callers default to Japanese. */
export function resolveLang(
  source = (globalThis as { location?: { search: string } }).location,
): Lang {
  return langFromSearch(source?.search ?? "");
}

export const lang = resolveLang();
export const t = createTranslator(lang === "en" ? en : ja);

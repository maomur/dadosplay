import { es, type I18nKey } from './es'

export type { I18nKey }

/** Traduce una clave e interpola {variables} */
export function translate(key: I18nKey | string, vars?: Record<string, string | number>): string {
  let s = (es as Record<string, string>)[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

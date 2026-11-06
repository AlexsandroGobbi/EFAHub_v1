export type ThemePreference = "light" | "dark" | "auto";
export type ResolvedTheme = Exclude<ThemePreference, "auto">;

export const THEME_STORAGE_KEY = "efahub-theme-preference-v1";

export function normalizeThemePreference(value: unknown): ThemePreference | null {
  return value === "light" || value === "dark" || value === "auto" ? value : null;
}

export function resolveThemePreference(preference: ThemePreference, date: Date): ResolvedTheme {
  if (preference !== "auto") return preference;
  const hour = date.getHours();
  return hour >= 18 || hour < 6 ? "dark" : "light";
}

export function nextThemePreference(preference: ThemePreference): ThemePreference {
  if (preference === "auto") return "light";
  if (preference === "light") return "dark";
  return "auto";
}

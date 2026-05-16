import { useEffect, useState } from "react";

const KEY = "pulse-theme";

export function useTheme() {
  // Always start with "dark" to match SSR; sync from storage after mount.
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) as
      | "light"
      | "dark"
      | null;
    const initial =
      saved ??
      (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }, [theme, mounted]);

  return {
    theme,
    mounted,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}

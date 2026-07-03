import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("tani_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window === "undefined") return "serif";
    return localStorage.getItem("tani_font_family") || "serif";
  });

  const [backgroundColor, setBackgroundColor] = useState(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem("tani_bg_color") || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("tani_theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const fontMap = {
      serif: "'Georgia', 'Times New Roman', serif",
      sans: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif",
      mono: "'Courier New', 'Courier', monospace",
    };
    root.style.setProperty("--font-family-body", fontMap[fontFamily] || fontMap.serif);
    localStorage.setItem("tani_font_family", fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    const root = document.documentElement;
    const bgMap = {
      default: "#ffffff",
      warm: "#fffbf0",
      cool: "#f0f4ff",
      dark: "#1a1a1a",
    };
    root.style.setProperty("--bg-color", bgMap[backgroundColor] || bgMap.default);
    localStorage.setItem("tani_bg_color", backgroundColor);
  }, [backgroundColor]);

  const value = useMemo(
    () => ({ 
      theme, 
      toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      fontFamily,
      setFontFamily,
      backgroundColor,
      setBackgroundColor,
    }),
    [theme, fontFamily, backgroundColor],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

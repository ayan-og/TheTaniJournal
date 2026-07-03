import React from "react";
import { useTheme } from "@/context/ThemeContext";

export default function FontStyleSelector() {
  const { fontFamily, setFontFamily } = useTheme();

  const fontOptions = [
    { id: "serif", label: "Serif", value: "'Georgia', serif" },
    { id: "sans", label: "Sans", value: "'Inter', sans-serif" },
    { id: "mono", label: "Mono", value: "'Courier New', monospace" },
  ];

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs uppercase tracking-[0.2em] text-secondary">Font</label>
      <div className="flex gap-2">
        {fontOptions.map((font) => (
          <button
            key={font.id}
            onClick={() => setFontFamily?.(font.id)}
            className={`px-3 py-1 rounded text-xs border transition-all ${
              fontFamily === font.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-secondary hover:text-foreground"
            }`}
            style={{ fontFamily: font.value }}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}

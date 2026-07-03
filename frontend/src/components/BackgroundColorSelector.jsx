import React from "react";
import { useTheme } from "@/context/ThemeContext";

export default function BackgroundColorSelector() {
  const { backgroundColor, setBackgroundColor } = useTheme();

  const colorOptions = [
    { id: "default", label: "White", color: "#ffffff" },
    { id: "warm", label: "Warm", color: "#fffbf0" },
    { id: "cool", label: "Cool", color: "#f0f4ff" },
    { id: "dark", label: "Dark", color: "#1a1a1a" },
  ];

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs uppercase tracking-[0.2em] text-secondary">Background</label>
      <div className="flex gap-2">
        {colorOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setBackgroundColor?.(opt.id)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              backgroundColor === opt.id ? "border-primary scale-110" : "border-border"
            }`}
            style={{ backgroundColor: opt.color }}
            title={opt.label}
          />
        ))}
      </div>
    </div>
  );
}

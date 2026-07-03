import React from "react";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

export default function ContentFilter({ hideExplicit = true, hide18Plus = true, onHideExplicitChange, onHide18PlusChange }) {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-surface border border-border">
      <p className="text-xs uppercase tracking-[0.2em] text-secondary mb-3">Content Filter</p>
      <Label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hideExplicit}
          onChange={(e) => onHideExplicitChange?.(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">Hide explicit content</span>
      </Label>
      <Label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={hide18Plus}
          onChange={(e) => onHide18PlusChange?.(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">Hide 18+ content</span>
      </Label>
    </div>
  );
}

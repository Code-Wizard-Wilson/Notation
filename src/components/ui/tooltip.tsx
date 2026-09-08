"use client";

import { Children, type HTMLAttributes, type ReactElement } from "react";
import { Tooltip as InteriorTooltip } from "@/components/interior/tooltip-group";

export function Tooltip({
  children,
  label,
  shortcut,
  side = "top",
  disabled = false,
}: {
  children: ReactElement;
  label: string;
  shortcut?: string;
  side?: "right" | "top" | "bottom";
  disabled?: boolean;
}) {
  const trigger = Children.only(children) as ReactElement<HTMLAttributes<HTMLElement> & { "aria-describedby"?: string }>;
  return (
    <InteriorTooltip
      side={side}
      disabled={disabled}
      className="tooltip-anchor"
      label={
        <span className="inline-flex items-center gap-2">
          <span>{label}</span>
          {shortcut ? (
            <span
              className="text-[9.5px] font-normal tabular-nums text-stone-400"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {shortcut}
            </span>
          ) : null}
        </span>
      }
    >
      {trigger}
    </InteriorTooltip>
  );
}

"use client";

import { create } from "zustand";
import { SETTINGS_KEY } from "@/lib/constants";

export type EditorFontFamily = "reference" | "inter" | "schibsted" | "system" | "handwritten";

type EditorSettings = {
  fontFamily: EditorFontFamily;
  fontSize: number;
  spellCheck: boolean;
  markdownShortcuts: boolean;
  showHints: boolean;
  readOnly: boolean;
};

type SettingsState = EditorSettings & {
  hydrate: () => void;
  update: (patch: Partial<EditorSettings>) => void;
};

const defaults: EditorSettings = {
  fontFamily: "reference",
  fontSize: 18,
  spellCheck: true,
  markdownShortcuts: true,
  showHints: true,
  readOnly: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaults,
  hydrate() {
    if (typeof window === "undefined") return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<EditorSettings> | null;
      if (stored) {
        const storedFontSize = Number(stored.fontSize);
        set({
          ...defaults,
          ...stored,
          fontFamily: ["reference", "inter", "schibsted", "system", "handwritten"].includes(String(stored.fontFamily))
            ? stored.fontFamily as EditorFontFamily
            : defaults.fontFamily,
          fontSize: Number.isFinite(storedFontSize)
            ? Math.min(32, Math.max(12, Math.round(storedFontSize)))
            : defaults.fontSize,
          showHints: stored.showHints !== false,
          readOnly: stored.readOnly === true,
        });
      }
    } catch {
      set(defaults);
    }
  },
  update(patch) {
    const nextPatch = patch.fontSize === undefined
      ? patch
      : { ...patch, fontSize: Math.min(32, Math.max(12, Math.round(patch.fontSize))) };
    set(nextPatch);
    if (typeof window !== "undefined") {
      const { fontFamily, fontSize, spellCheck, markdownShortcuts, showHints, readOnly } = get();
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ fontFamily, fontSize, spellCheck, markdownShortcuts, showHints, readOnly }),
      );
    }
  },
}));
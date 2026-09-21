"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Archive, FileUp, HardDrive, Minus, Plus, Trash2 } from "lucide-react";
import { Drawer } from "@/components/interior/drawer";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useSettingsStore, type EditorFontFamily } from "@/store/settings-store";
import { UI_MOTION } from "@/lib/motion";
import { useNotesActions } from "@/hooks/use-notes-actions";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <motion.span layout transition={UI_MOTION.layout} />
    </button>
  );
}

export function SettingsSheet() {
  const open = useWorkspaceStore((state) => state.settingsOpen);
  const setOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const archivedCount = useWorkspaceStore((state) => state.notes.filter((note) => note.isArchived && !note.isDeleted).length);
  const trashCount = useWorkspaceStore((state) => state.notes.filter((note) => note.isDeleted).length);
  const setView = useWorkspaceStore((state) => state.setView);
  const fontFamily = useSettingsStore((state) => state.fontFamily);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const spellCheck = useSettingsStore((state) => state.spellCheck);
  const markdownShortcuts = useSettingsStore((state) => state.markdownShortcuts);
  const showHints = useSettingsStore((state) => state.showHints);
  const update = useSettingsStore((state) => state.update);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importingMarkdown, setImportingMarkdown] = useState(false);
  const { importMarkdownFiles } = useNotesActions();

  async function handleMarkdownImport(files: FileList | null) {
    if (!files?.length || importingMarkdown) return;
    setImportingMarkdown(true);
    try {
      const imported = await importMarkdownFiles(Array.from(files));
      if (imported.length) setOpen(false);
    } finally {
      setImportingMarkdown(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      side="right"
      width={360}
      title="Settings"
      description="Workspace preferences"
      closeLabel="Close settings"
    >
      <div className="interior-settings-content">
        <section className="settings-section mobile-library-settings">
          <p className="settings-label">LIBRARY</p>
          <button type="button" className="library-link" onClick={() => { setView("archive"); setOpen(false); }}>
            <span><Archive size={15} /> Archive</span><small>{archivedCount}</small>
          </button>
          <button type="button" className="library-link" onClick={() => { setView("trash"); setOpen(false); }}>
            <span><Trash2 size={15} /> Trash</span><small>{trashCount}</small>
          </button>
          <button
            type="button"
            className="library-link markdown-import-link"
            disabled={importingMarkdown}
            onClick={() => importInputRef.current?.click()}
          >
            <span><FileUp size={15} /> Import Markdown</span>
            <small>{importingMarkdown ? "IMPORTING" : ".MD"}</small>
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown"
            multiple
            aria-label="Import Markdown notes"
            onChange={(event) => void handleMarkdownImport(event.target.files)}
          />
        </section>

        <section className="settings-section">
          <p className="settings-label">EDITOR</p>

          <div className="setting-row setting-stack font-family-setting">
            <span><strong>Typeface</strong><small>Used across the interface and editor</small></span>
            <div className="font-family-grid" role="group" aria-label="Typeface">
              {[
                { id: "reference", label: "Reference", sample: "Aa", className: "is-reference" },
                { id: "inter", label: "Inter", sample: "Aa", className: "is-inter" },
                { id: "schibsted", label: "Schibsted", sample: "Aa", className: "is-schibsted" },
                { id: "system", label: "System", sample: "Aa", className: "is-system" },
                { id: "handwritten", label: "Handwritten", sample: "Aa", className: "is-handwritten" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`font-family-option ${option.className}${fontFamily === option.id ? " is-active" : ""}`}
                  aria-pressed={fontFamily === option.id}
                  onClick={() => update({ fontFamily: option.id as EditorFontFamily })}
                >
                  <span className="font-family-sample">{option.sample}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="setting-row setting-stack">
            <span><strong>Text size</strong><small>12–32 px</small></span>
            <div className="font-size-control">
              <button
                type="button"
                aria-label="Decrease editor text size"
                disabled={fontSize <= 12}
                onClick={() => update({ fontSize: Math.max(12, fontSize - 1) })}
              >
                <Minus size={14} />
              </button>
              <input
                type="range"
                min={12}
                max={32}
                step={1}
                value={fontSize}
                style={{ "--range-progress": `${((fontSize - 12) / 20) * 100}%` } as React.CSSProperties}
                aria-label="Editor text size"
                aria-valuetext={`${fontSize} pixels`}
                onChange={(event) => update({ fontSize: Number(event.target.value) })}
              />
              <output>{fontSize}px</output>
              <button
                type="button"
                aria-label="Increase editor text size"
                disabled={fontSize >= 32}
                onClick={() => update({ fontSize: Math.min(32, fontSize + 1) })}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="setting-row">
            <span><strong>Spell check</strong><small>Use your browser dictionary</small></span>
            <Toggle label="Spell check" checked={spellCheck} onChange={(value) => update({ spellCheck: value })} />
          </div>
          <div className="setting-row">
            <span><strong>Markdown shortcuts</strong><small>Convert syntax while typing</small></span>
            <Toggle label="Markdown shortcuts" checked={markdownShortcuts} onChange={(value) => update({ markdownShortcuts: value })} />
          </div>
          <div className="setting-row">
            <span><strong>Editor hints</strong><small>Show writing and block hints</small></span>
            <Toggle label="Editor hints" checked={showHints} onChange={(value) => update({ showHints: value })} />
          </div>
        </section>

        <section className="settings-section account-settings">
          <p className="settings-label">STORAGE</p>
          <div className="setting-row">
            <span className="local-storage-copy">
              <strong><HardDrive size={15} /> On this device</strong>
              <small>Notes stay in this browser and are mirrored as Markdown to ~/Documents/Notation Data/Notes when Notation runs locally. Attachments and recovery backups stay beside them. Nothing is uploaded.</small>
            </span>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
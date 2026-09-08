"use client";

import { Archive, FileText, Pin, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";
import { cn } from "@/lib/utils";

const entries = [
  { id: "all" as const, label: "All notes", icon: FileText },
  { id: "pinned" as const, label: "Pinned", icon: Pin },
  { id: "archive" as const, label: "Archive", icon: Archive },
  { id: "trash" as const, label: "Trash", icon: Trash2 },
];

export function TabletRail() {
  const view = useWorkspaceStore((state) => state.view);
  const setView = useWorkspaceStore((state) => state.setView);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const setSettingsOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const { createNote } = useNotesActions();
  return (
    <nav className="tablet-rail" aria-label="Workspace navigation">
      <button className="tablet-new" type="button" onClick={createNote} aria-label="New note"><Plus size={18} /></button>
      <button type="button" onClick={() => setCommandOpen(true)} aria-label="Search"><Search size={17} /></button>
      <span className="tablet-divider" />
      {entries.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={cn(view === id && "is-active")} onClick={() => setView(id)} aria-label={label}><Icon size={17} /></button>
      ))}
      <button className="tablet-settings" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings size={17} /></button>
    </nav>
  );
}

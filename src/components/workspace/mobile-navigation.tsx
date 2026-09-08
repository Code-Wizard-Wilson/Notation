"use client";

import { motion } from "motion/react";
import { FileText, Pin, Plus, Search, Settings } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useNotesActions } from "@/hooks/use-notes-actions";

export function MobileNavigation() {
  const pane = useWorkspaceStore((state) => state.mobilePane);
  const view = useWorkspaceStore((state) => state.view);
  const setView = useWorkspaceStore((state) => state.setView);
  const setCommandOpen = useWorkspaceStore((state) => state.setCommandOpen);
  const setSettingsOpen = useWorkspaceStore((state) => state.setSettingsOpen);
  const { createNote } = useNotesActions();

  if (pane !== "list") return null;
  return (
    <motion.nav className="mobile-navigation menu-surface" aria-label="Mobile navigation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button type="button" className={view === "all" ? "is-active" : ""} onClick={() => setView("all")}><FileText size={18} /><span>Notes</span></button>
      <button type="button" className={view === "pinned" ? "is-active" : ""} onClick={() => setView("pinned")}><Pin size={18} /><span>Pinned</span></button>
      <button type="button" className="mobile-create" onClick={createNote} aria-label="New note"><Plus size={20} /></button>
      <button type="button" onClick={() => setCommandOpen(true)}><Search size={18} /><span>Search</span></button>
      <button type="button" onClick={() => setSettingsOpen(true)}><Settings size={18} /><span>Settings</span></button>
    </motion.nav>
  );
}

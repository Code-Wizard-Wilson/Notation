"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { createPortal } from "react-dom";
import { Columns3, Minus, Plus, Rows3, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export function TableToolbar({ editor }: { editor: Editor }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const frameRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  const update = useCallback(() => {
    if (editor.isDestroyed || typeof window === "undefined" || !editor.isEditable) return;
    if (!editor.isActive("table")) {
      setVisible(false);
      return;
    }

    const { from } = editor.state.selection;
    let domNode: Node;
    try {
      domNode = editor.view.domAtPos(from).node;
    } catch {
      setVisible(false);
      return;
    }

    const element = domNode.nodeType === Node.ELEMENT_NODE
      ? domNode as Element
      : domNode.parentElement;
    const table = element?.closest("table");
    if (!table) {
      setVisible(false);
      return;
    }

    const rect = table.getBoundingClientRect();
    const width = 188;
    const margin = 10;
    const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
    const top = Math.max(margin, rect.top - 38);
    setPosition({ left, top });
    setVisible(true);
  }, [editor]);

  const schedule = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      update();
    });
  }, [update]);

  useEffect(() => {
    const hideOnBlur = () => window.setTimeout(() => {
      const active = document.activeElement;
      if (active?.closest?.(".table-toolbar")) return;
      schedule();
    }, 0);
    editor.on("selectionUpdate", schedule);
    editor.on("transaction", schedule);
    editor.on("focus", schedule);
    editor.on("blur", hideOnBlur);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("transaction", schedule);
      editor.off("focus", schedule);
      editor.off("blur", hideOnBlur);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [editor, schedule]);

  if (typeof document === "undefined") return null;

  const run = (command: () => boolean) => {
    command();
    editor.commands.focus();
    schedule();
  };

  return createPortal(
    <motion.div
      className="table-toolbar menu-surface"
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      initial={false}
      animate={reduced ? { opacity: visible ? 1 : 0 } : { opacity: visible ? 1 : 0, y: visible ? 0 : 3, scale: visible ? 1 : 0.99 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 34, mass: 0.48 }}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 88,
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button type="button" aria-label="Add row" title="Add row" onClick={() => run(() => editor.chain().focus().addRowAfter().run())}>
        <Rows3 size={14} /><Plus size={10} />
      </button>
      <button type="button" aria-label="Delete row" title="Delete row" onClick={() => run(() => editor.chain().focus().deleteRow().run())}>
        <Rows3 size={14} /><Minus size={10} />
      </button>
      <span className="table-toolbar-separator" />
      <button type="button" aria-label="Add column" title="Add column" onClick={() => run(() => editor.chain().focus().addColumnAfter().run())}>
        <Columns3 size={14} /><Plus size={10} />
      </button>
      <button type="button" aria-label="Delete column" title="Delete column" onClick={() => run(() => editor.chain().focus().deleteColumn().run())}>
        <Columns3 size={14} /><Minus size={10} />
      </button>
      <span className="table-toolbar-separator" />
      <button type="button" className="is-danger" aria-label="Delete table" title="Delete table" onClick={() => run(() => editor.chain().focus().deleteTable().run())}>
        <Trash2 size={14} />
      </button>
    </motion.div>,
    document.body,
  );
}

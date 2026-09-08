"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const EASE = [0.23, 1, 0.32, 1] as const;
const EXIT = [0.4, 0, 1, 1] as const;
const CELL = { type: "spring", stiffness: 430, damping: 32, mass: 0.5 } as const;
const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const ROW_ENTER = { type: "spring", stiffness: 420, damping: 30, mass: 0.5 } as const;

export type EditorMenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ size?: number }>;
  group?: string;
  shortcut?: string;
  onSelect: () => void;
};

export function EditorMenu({ label, items, position, onClose }: {
  label: string;
  items: EditorMenuItem[];
  position: { left: number; top: number };
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const safeActive = Math.min(active, Math.max(0, items.length - 1));
  const itemSignature = items.map((item) => item.id).join("|");

  useEffect(() => {
    setActive(0);
  }, [itemSignature]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault(); event.stopPropagation();
        setActive((index) => (index + 1) % Math.max(items.length, 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault(); event.stopPropagation();
        setActive((index) => (index - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
      } else if (event.key === "Home") {
        event.preventDefault(); event.stopPropagation(); setActive(0);
      } else if (event.key === "End") {
        event.preventDefault(); event.stopPropagation(); setActive(Math.max(items.length - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault(); event.stopPropagation(); items[safeActive]?.onSelect();
      } else if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); onClose();
      }
    }
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  }, [items, onClose, safeActive]);

  return (
    <motion.div
      className="editor-menu interior-editor-menu"
      style={{ left: position.left, top: position.top, transformOrigin: "top left" }}
      role="listbox"
      aria-label={label}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985, transition: { duration: 0.12, ease: EXIT } }}
      transition={reduced ? { duration: 0 } : { duration: 0.18, ease: EASE }}
    >
      <p>{label}</p>
      <motion.div className="editor-menu-list" layout={reduced ? false : "size"}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive = safeActive === index;
            const showGroup = Boolean(item.group && item.group !== items[index - 1]?.group);
            return (
              <motion.div
                key={item.id}
                className="editor-menu-entry"
                layout={reduced ? false : "position"}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.992 }}
                transition={reduced ? { duration: 0 } : ROW_ENTER}
              >
                {showGroup ? <span className="editor-menu-group">{item.group}</span> : null}
                <motion.button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  transition={reduced ? { duration: 0 } : CELL}
                  onPointerMove={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={item.onSelect}
                >
                  <motion.span aria-hidden className="editor-menu-active" initial={false} animate={{ opacity: isActive ? 1 : 0 }} transition={reduced ? { duration: 0 } : CROSSFADE} />
                  <span className="editor-menu-row-content">
                    {Icon ? <span className="editor-menu-icon"><Icon size={15} /></span> : null}
                    <span className="editor-menu-copy"><strong>{item.label}</strong>{item.description ? <small>{item.description}</small> : null}</span>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </span>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

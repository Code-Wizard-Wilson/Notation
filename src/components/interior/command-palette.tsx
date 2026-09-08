"use client";
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const CROSSFADE = { type: "tween", duration: 0.14, ease: [0.16, 1, 0.3, 1] } as const;
const BOUNDARY = /[\s\-_/.:]/;
const ROW = 60;
const GAP = 4;
const PAD = 8;

export type CommandItem = {
  id: string;
  label: string;
  meta?: string;
  hint?: string;
  keywords?: string;
  shortcut?: string[];
  icon?: React.ReactNode;
};

export type UseCommandPaletteOptions = {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  onDismiss?: () => void;
};

function scoreOne(text: string, query: string): number {
  const t = text.toLowerCase();
  let cursor = 0;
  let total = 0;
  let streak = 0;

  for (let i = 0; i < query.length; i++) {
    const at = t.indexOf(query[i], cursor);
    if (at < 0) return -1;
    streak = at === cursor && i > 0 ? streak + 1 : 0;
    total += 2 + streak * 4;
    if (at === 0) total += 12;
    else if (BOUNDARY.test(t[at - 1])) total += 8;
    cursor = at + 1;
  }

  return total;
}

function rank(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const scored: { item: CommandItem; score: number; order: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const direct = scoreOne(item.label, q);
    const aliased = item.keywords ? scoreOne(item.keywords, q) - 3 : -1;
    const best = Math.max(direct, item.keywords ? aliased : -1);
    if (best < 0) continue;
    scored.push({ item, score: best - item.label.length * 0.05, order: i });
  }

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.item);
}

export function useCommandPalette({ items, onSelect, onDismiss }: UseCommandPaletteOptions) {
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pointer = useRef({ x: -1, y: -1 });
  const select = useRef(onSelect);
  const dismiss = useRef(onDismiss);
  select.current = onSelect;
  dismiss.current = onDismiss;

  const results = useMemo(() => rank(items, query), [items, query]);
  const activeId = results.some((r) => r.id === pinned) ? pinned : (results[0]?.id ?? null);
  const activeIndex = results.findIndex((r) => r.id === activeId);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  const reveal = (index: number) => {
    const list = listRef.current;
    const row = list?.children[index];
    if (!list || !(row instanceof HTMLElement)) return;
    const top = row.offsetTop - PAD;
    const bottom = row.offsetTop + row.offsetHeight + PAD;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  };

  const jump = (index: number) => {
    if (results.length === 0) return;
    const next = Math.max(0, Math.min(results.length - 1, index));
    setPinned(results[next].id);
    reveal(next);
  };

  const move = (delta: number) => {
    if (results.length === 0) return;
    const from = activeIndex < 0 ? 0 : activeIndex;
    jump((from + delta + results.length) % results.length);
  };

  const run = (item?: CommandItem) => {
    const target = item ?? results.find((r) => r.id === activeId);
    if (target) select.current(target);
  };

  const pointerActivate = (id: string, event: React.PointerEvent) => {
    const { x, y } = pointer.current;
    if (event.clientX === x && event.clientY === y) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (id !== activeId) setPinned(id);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      jump(0);
    } else if (event.key === "End") {
      event.preventDefault();
      jump(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run();
    } else if (event.key === "Escape") {
      event.preventDefault();
      dismiss.current?.();
    }
  };

  return { query, setQuery, results, activeId, listRef, onKeyDown, pointerActivate, run };
}

export type CommandPaletteProps = {
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
  onDismiss?: () => void;
  open?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  label?: string;
  maxRows?: number;
  autoFocus?: boolean;
  className?: string;
};

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[6px] border border-stone-200/90 bg-white px-1.5 font-mono text-[9.5px] leading-none text-stone-500 shadow-[0_1px_1px_rgba(28,25,23,0.03)]">
      {children}
    </span>
  );
}

export function CommandPalette({
  items,
  onSelect,
  onDismiss,
  open,
  placeholder = "Search commands",
  emptyLabel = "No command matches",
  label = "Command palette",
  maxRows = 4,
  autoFocus = false,
  className = "",
}: CommandPaletteProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);
  const { query, setQuery, results, activeId, listRef, onKeyDown, pointerActivate, run } = useCommandPalette({ items, onSelect, onDismiss });
  const rows = Math.max(1, Math.min(maxRows, items.length));
  const height = PAD * 2 + rows * ROW + (rows - 1) * GAP;
  const count = results.length;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open, setQuery]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!liveRef.current) return;
      liveRef.current.textContent = count === 0 ? emptyLabel : `${count} ${count === 1 ? "result" : "results"} available`;
    }, 300);
    return () => clearTimeout(id);
  }, [count, emptyLabel]);

  const overlaid = open !== undefined;
  const surface = (
    <div
      ref={panelRef}
      className={`min-w-0 overflow-hidden rounded-[18px] border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04),0_26px_70px_-26px_rgba(24,22,20,0.38)] ${
        overlaid ? "w-full max-w-[620px]" : ""
      } ${className}`}
    >
      <div className="flex h-16 min-w-0 items-center gap-3.5 overflow-hidden border-b border-stone-200/80 px-5">
        <svg viewBox="0 0 20 20" className="size-[18px] shrink-0 text-stone-500" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" aria-hidden>
          <circle cx="8.5" cy="8.5" r="5.25" />
          <path d="M12.4 12.4 16.6 16.6" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded
          aria-controls={`${uid}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId ? `${uid}-${activeId}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-full w-0 min-w-0 flex-1 border-0 bg-transparent text-[17px] font-[450] tracking-[-0.018em] text-stone-800 outline-none shadow-none ring-0 placeholder:text-stone-400 focus:outline-none focus:ring-0 focus-visible:shadow-none"
        />
      </div>

      <div className="relative bg-[#fdfdfc]" style={{ height }}>
        <ul
          ref={listRef}
          id={`${uid}-list`}
          role="listbox"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-0 flex min-w-0 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]"
        >
          {results.map((item) => {
            const active = item.id === activeId;
            return (
              <li
                key={item.id}
                id={`${uid}-${item.id}`}
                role="option"
                aria-selected={active}
                onPointerMove={(e) => pointerActivate(item.id, e)}
                onClick={() => run(item)}
                className={`group relative flex h-[60px] min-w-0 shrink-0 cursor-default items-center overflow-hidden rounded-[12px] px-3 transition-colors duration-100 ${
                  active ? "bg-[rgba(197,243,103,0.34)]" : "bg-transparent"
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] border transition-colors duration-100 ${
                  active
                    ? "border-[rgba(143,188,52,0.24)] bg-[rgba(197,243,103,0.66)] text-stone-900"
                    : "border-stone-200/80 bg-white text-stone-500"
                }`}>
                  {item.icon ?? <span className="size-1.5 rounded-full bg-current" />}
                </span>

                <span className="ml-3.5 flex min-w-0 flex-1 flex-col justify-center gap-[3px] overflow-hidden">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-[14.5px] font-[560] tracking-[-0.01em] text-stone-800">{item.label}</span>
                    {item.meta ? <span className="shrink-0 text-[10.5px] font-medium text-stone-400">{item.meta}</span> : null}
                  </span>
                  {item.hint ? <span className="min-w-0 truncate text-[11.5px] leading-[1.25] text-stone-500">{item.hint}</span> : null}
                </span>

                {item.shortcut ? (
                  <span className="ml-3 flex shrink-0 items-center gap-1">
                    {item.shortcut.map((key) => <KeyHint key={key}>{key}</KeyHint>)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {count === 0 ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduced ? { duration: 0 } : CROSSFADE}
            className="pointer-events-none absolute inset-0 grid place-items-center px-5 text-center"
          >
            <div>
              <p className="m-0 text-[14px] font-medium text-stone-700">Nothing found</p>
              <p className="mt-1 text-[11.5px] text-stone-400">{emptyLabel}</p>
            </div>
          </motion.div>
        ) : null}
      </div>

      <div className="flex h-[38px] items-center justify-between border-t border-stone-200/80 bg-white px-4.5 text-[10.5px] text-stone-400">
        <span className="font-mono tabular-nums">{count} {count === 1 ? "result" : "results"}</span>
        <span className="flex items-center gap-3.5">
          <span className="flex items-center gap-1.5"><KeyHint>↑↓</KeyHint><span>Navigate</span></span>
          <span className="flex items-center gap-1.5"><KeyHint>↵</KeyHint><span>Open</span></span>
          <span className="flex items-center gap-1.5"><KeyHint>esc</KeyHint><span>Close</span></span>
        </span>
      </div>

      <span ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );

  if (!overlaid) return surface;
  return <PaletteLayer open={open} onDismiss={onDismiss} reduced={Boolean(reduced)} panelRef={panelRef}>{surface}</PaletteLayer>;
}

const LAYER_EASE = [0.16, 1, 0.3, 1] as const;
const LAYER_OUT = [0.4, 0, 1, 1] as const;

function PaletteLayer({ open, onDismiss, reduced, panelRef, children }: { open: boolean; onDismiss?: () => void; reduced: boolean; panelRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode; }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const downedOutside = useRef(false);
  const leave = useRef(onDismiss);
  leave.current = onDismiss;

  useEffect(() => setHost(document.body), []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      leave.current?.();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    const padding = root.style.paddingRight;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    return () => {
      root.style.overflow = overflow;
      root.style.paddingRight = padding;
    };
  }, [open]);

  if (!host) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="palette-layer"
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          initial="closed"
          animate="open"
          exit="gone"
          variants={{ closed: {}, open: {}, gone: {} }}
          onPointerDown={(event) => {
            const panel = panelRef.current;
            downedOutside.current = !panel?.contains(event.target as Node);
          }}
          onClick={(event) => {
            const panel = panelRef.current;
            if (panel?.contains(event.target as Node)) return;
            if (!downedOutside.current) return;
            downedOutside.current = false;
            leave.current?.();
          }}
        >
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            variants={{
              closed: { opacity: 0 },
              open: { opacity: 1, transition: reduced ? { duration: 0 } : { duration: 0.17, ease: LAYER_EASE } },
              gone: { opacity: 0, transition: reduced ? { duration: 0 } : { duration: 0.12, ease: LAYER_OUT } },
            }}
          />
          <motion.div
            className="relative flex w-full justify-center"
            variants={{
              closed: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
              open: { opacity: 1, y: 0, transition: reduced ? { duration: 0 } : { duration: 0.2, ease: LAYER_EASE } },
              gone: reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4, transition: { duration: 0.12, ease: LAYER_OUT } },
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    host,
  );
}

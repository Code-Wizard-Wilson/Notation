"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Editor } from "@tiptap/core";
import { createPortal } from "react-dom";
import { Bold, Braces, ChevronDown, Highlighter, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={cn(active && "is-active")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [linkMode, setLinkMode] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [placement, setPlacement] = useState<"above" | "below">("above");
  const reducedMotion = useReducedMotion();

  const hideToolbar = useCallback(() => {
    setVisible(false);
    setLinkMode(false);
    setHeadingOpen(false);
    setFontOpen(false);
    setHighlightOpen(false);
  }, []);

  const updatePosition = useCallback(() => {
    if (editor.isDestroyed || typeof window === "undefined") return;

    const { from, to } = editor.state.selection;
    // Keep the toolbar selection-driven. A collapsed caret at the end of a link
    // must not summon formatting chrome just because the link mark is active.
    const shouldShow =
      editor.isEditable &&
      !editor.isActive("image") &&
      !editor.isActive("attachment") &&
      from !== to;

    if (!shouldShow) {
      setVisible(false);
      return;
    }

    let fromRect: ReturnType<typeof editor.view.coordsAtPos>;
    let toRect: ReturnType<typeof editor.view.coordsAtPos>;
    try {
      fromRect = editor.view.coordsAtPos(from);
      toRect = editor.view.coordsAtPos(to);
    } catch {
      setVisible(false);
      return;
    }

    const element = toolbarRef.current;
    const width = element?.offsetWidth || 360;
    const height = element?.offsetHeight || 44;
    const selectionLeft = Math.min(fromRect.left, toRect.left);
    const selectionRight = Math.max(fromRect.right, toRect.right);
    const center = (selectionLeft + selectionRight) / 2;
    const margin = 10;
    const gap = 9;
    const left = Math.max(margin, Math.min(center - width / 2, window.innerWidth - width - margin));
    const topAbove = Math.min(fromRect.top, toRect.top) - height - gap;
    const topBelow = Math.max(fromRect.bottom, toRect.bottom) + gap;
    const placeAbove = topAbove >= margin;
    const top = placeAbove ? topAbove : Math.min(topBelow, window.innerHeight - height - margin);

    setPlacement(placeAbove ? "above" : "below");
    setPosition((current) =>
      Math.abs(current.left - left) < 0.5 && Math.abs(current.top - top) < 0.5
        ? current
        : { left, top },
    );
    setVisible(true);
  }, [editor]);

  const schedulePosition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useEffect(() => {
    function openLinkEditor() {
      if (editor.state.selection.empty) return;
      setUrl(editor.getAttributes("link").href ?? "");
      setLinkMode(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
    window.addEventListener("notation:edit-link", openLinkEditor);
    return () => window.removeEventListener("notation:edit-link", openLinkEditor);
  }, [editor]);

  useEffect(() => {
    const onEditorUpdate = () => schedulePosition();
    const onEditorBlur = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (toolbarRef.current?.contains(active)) return;
        hideToolbar();
      }, 0);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && toolbarRef.current?.contains(target)) return;
      if (target && editor.view.dom.contains(target)) return;
      hideToolbar();
    };

    editor.on("selectionUpdate", onEditorUpdate);
    editor.on("transaction", onEditorUpdate);
    editor.on("focus", onEditorUpdate);
    editor.on("blur", onEditorBlur);
    window.addEventListener("resize", onEditorUpdate);
    window.addEventListener("scroll", onEditorUpdate, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    schedulePosition();

    return () => {
      editor.off("selectionUpdate", onEditorUpdate);
      editor.off("transaction", onEditorUpdate);
      editor.off("focus", onEditorUpdate);
      editor.off("blur", onEditorBlur);
      window.removeEventListener("resize", onEditorUpdate);
      window.removeEventListener("scroll", onEditorUpdate, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [editor, hideToolbar, schedulePosition]);

  useEffect(() => {
    if (!visible || !toolbarRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => schedulePosition());
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, [visible, schedulePosition]);

  function editLink() {
    setUrl(editor.getAttributes("link").href ?? "");
    setLinkMode(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function applyLink() {
    const href = url.trim();
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      const normalized = /^(https?:\/\/|mailto:|note:)/i.test(href) ? href : `https://${href}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    }
    setLinkMode(false);
  }

  const fontOptions = [
    { label: "Default", value: "", className: "is-default" },
    { label: "Reference", value: "Helvetica Neue", className: "is-reference" },
    { label: "Inter", value: "Inter Variable", className: "is-inter" },
    { label: "Schibsted", value: "Schibsted Grotesk Variable", className: "is-schibsted" },
    { label: "Handwritten", value: "Neucha", className: "is-handwritten" },
  ];

  const highlightOptions = [
    { label: "Yellow", color: "#FEF08A" },
    { label: "Blue", color: "#BFDBFE" },
    { label: "Green", color: "#BBF7D0" },
    { label: "Pink", color: "#FBCFE8" },
  ];

  const activeFont = String(editor.getAttributes("textStyle").fontFamily ?? "");
  const activeHighlight = String(editor.getAttributes("highlight").color ?? "");

  function applyFont(fontFamily: string) {
    const chain = editor.chain().focus();
    if (fontFamily) chain.setFontFamily(fontFamily).run();
    else chain.unsetFontFamily().run();
    setFontOpen(false);
  }

  function applyHighlight(color: string) {
    editor.chain().focus().setHighlight({ color }).run();
    setHighlightOpen(false);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={toolbarRef}
      className="bubble-toolbar menu-surface"
      data-visible={visible ? "true" : "false"}
      aria-hidden={!visible}
      initial={false}
      animate={
        reducedMotion
          ? { opacity: visible ? 1 : 0 }
          : visible
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: placement === "above" ? 5 : -5, scale: 0.985 }
      }
      transition={
        reducedMotion
          ? { duration: 0 }
          : visible
            ? { type: "spring", stiffness: 470, damping: 32, mass: 0.48 }
            : { duration: 0.13, ease: [0.4, 0, 1, 1] }
      }
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 90,
        pointerEvents: visible ? "auto" : "none",
        transformOrigin: placement === "above" ? "50% 100%" : "50% 0%",
        willChange: "transform, opacity",
      }}
    >
      {linkMode ? (
        <form
          className="toolbar-link-form"
          onSubmit={(event) => { event.preventDefault(); applyLink(); }}
        >
          <Link2 size={14} />
          <input
            ref={inputRef}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkMode(false);
                editor.commands.focus();
              }
            }}
            placeholder="Paste or type a link"
            aria-label="Link URL"
          />
          <button type="submit">APPLY</button>
        </form>
      ) : (
        <>
          <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={15} /></ToolbarButton>
          <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></ToolbarButton>
          <ToolbarButton label="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Braces size={15} /></ToolbarButton>
          <span className="toolbar-separator" />
          <div className="toolbar-font-wrap">
            <ToolbarButton label="Font" active={Boolean(activeFont)} onClick={() => { setFontOpen((open) => !open); setHighlightOpen(false); setHeadingOpen(false); }}>
              <span className="toolbar-font-glyph">Aa</span><ChevronDown size={10} />
            </ToolbarButton>
            {fontOpen && (
              <div className="style-submenu font-menu menu-surface" aria-label="Font family">
                <small className="style-submenu-label">FONT</small>
                {fontOptions.map((option) => (
                  <button key={option.label} type="button" className={cn("font-menu-option", option.className, activeFont === option.value && "is-selected")} onMouseDown={(event) => event.preventDefault()} onClick={() => applyFont(option.value)}>
                    <span className="font-menu-preview">Aa</span><span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="toolbar-highlight-wrap">
            <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => { setHighlightOpen((open) => !open); setFontOpen(false); setHeadingOpen(false); }}>
              <span className="toolbar-highlight-icon" style={{ "--marker-color": activeHighlight || "#FEF08A" } as React.CSSProperties}><Highlighter size={15} /></span>
            </ToolbarButton>
            {highlightOpen && (
              <div className="style-submenu highlight-menu menu-surface" aria-label="Highlight color">
                <small className="style-submenu-label">HIGHLIGHT</small>
                <div className="highlight-swatches">
                  {highlightOptions.map((option) => (
                    <button key={option.color} type="button" aria-label={`${option.label} highlight`} aria-pressed={activeHighlight.toUpperCase() === option.color} className={cn("highlight-swatch", activeHighlight.toUpperCase() === option.color && "is-selected")} style={{ "--swatch": option.color } as React.CSSProperties} onMouseDown={(event) => event.preventDefault()} onClick={() => applyHighlight(option.color)} />
                  ))}
                </div>
                <button type="button" className="highlight-clear" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().unsetHighlight().run(); setHighlightOpen(false); }}>Remove highlight</button>
              </div>
            )}
          </div>
          <span className="toolbar-separator" />
          <div className="toolbar-heading-wrap">
            <ToolbarButton label="Turn into" active={editor.isActive("heading")} onClick={() => { setHeadingOpen((open) => !open); setFontOpen(false); setHighlightOpen(false); }}>
              <span className="toolbar-text">Turn into</span><ChevronDown size={11} />
            </ToolbarButton>
            <AnimatePresence initial={false}>
              {headingOpen && (
                <motion.div
                  className="heading-menu turn-into-menu menu-surface"
                  aria-label="Turn into"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 3, scale: 0.992 }}
                  transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 31, mass: 0.52 }}
                >
                  <small className="turn-into-label">TURN INTO</small>
                  {[
                    ["Text", () => editor.chain().focus().setParagraph().run()],
                    ["Heading 1", () => editor.chain().focus().toggleHeading({ level: 1 }).run()],
                    ["Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
                    ["Heading 3", () => editor.chain().focus().toggleHeading({ level: 3 }).run()],
                  ].map(([label, action], index) => (
                    <motion.button
                      key={String(label)}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { (action as () => void)(); setHeadingOpen(false); }}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { delay: 0.012 * index, duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    >
                      {String(label)}
                    </motion.button>
                  ))}
                  <motion.span className="turn-into-separator" layout />
                  {[
                    ["Bullet list", () => editor.chain().focus().toggleBulletList().run()],
                    ["Numbered list", () => editor.chain().focus().toggleOrderedList().run()],
                    ["To-do", () => editor.chain().focus().toggleTaskList().run()],
                    ["Quote", () => editor.chain().focus().toggleBlockquote().run()],
                    ["Code", () => editor.chain().focus().toggleCodeBlock().run()],
                  ].map(([label, action], index) => (
                    <motion.button
                      key={String(label)}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { (action as () => void)(); setHeadingOpen(false); }}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reducedMotion ? { duration: 0 } : { delay: 0.012 * (index + 4), duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    >
                      {String(label)}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ToolbarButton label="Link" active={editor.isActive("link")} onClick={editLink}><Link2 size={15} /></ToolbarButton>
        </>
      )}
    </motion.div>,
    document.body,
  );
}

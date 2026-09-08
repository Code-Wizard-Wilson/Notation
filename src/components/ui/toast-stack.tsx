"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { IconButton } from "@/components/ui/icon-button";
import { UI_MOTION } from "@/lib/motion";
import type { ToastMessage } from "@/types/note";

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useWorkspaceStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.actionLabel ? 6200 : 4200);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.actionLabel, toast.id]);

  return (
    <motion.div
      role={toast.tone === "error" ? "alert" : "status"}
      className={`toast menu-surface${toast.tone === "error" ? " toast-error" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={UI_MOTION.fast}
    >
      <span>{toast.title}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.onAction?.();
            dismiss(toast.id);
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <IconButton aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        <X size={14} />
      </IconButton>
    </motion.div>
  );
}

export function ToastStack() {
  const toasts = useWorkspaceStore((state) => state.toasts);
  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} />)}
      </AnimatePresence>
    </div>
  );
}

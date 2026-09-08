"use client";

import { useRef } from "react";
import { Modal } from "@/components/interior/modal";

const SECONDARY_BUTTON =
  "confirm-secondary-button h-8 rounded-[8px] border border-stone-200 bg-white px-3 text-[12.5px] font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-stone-100 focus-visible:border-[#4568FF]";

const PRIMARY_BUTTON =
  "confirm-primary-button grid h-8 place-items-center rounded-[8px] bg-stone-800 px-3 text-[12.5px] font-medium text-white outline-none transition-colors duration-150 hover:bg-stone-700 focus-visible:shadow-[inset_0_0_0_1px_#93B0FF]";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      initialFocusRef={cancelRef}
      footer={
        <>
          <button ref={cancelRef} type="button" className={SECONDARY_BUTTON} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

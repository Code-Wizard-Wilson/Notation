import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function IconButton({ className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={cn("icon-button", className)} {...props} />;
  },
);

export const UI_EASE = [0.16, 1, 0.3, 1] as const;

export const UI_MOTION = {
  fast: { duration: 0.16, ease: UI_EASE },
  default: { duration: 0.24, ease: UI_EASE },
  panel: { duration: 0.3, ease: UI_EASE },
  layout: { duration: 0.26, ease: UI_EASE },
} as const;

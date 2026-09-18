"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function HoverMarquee({ text, className }: { text: string; className?: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const measure = () => {
      const distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
      viewport.style.setProperty("--marquee-distance", `${distance}px`);
      viewport.style.setProperty(
        "--marquee-duration",
        `${Math.max(1.8, Math.min(4.8, distance / 28)).toFixed(2)}s`,
      );
      if (distance > 4) viewport.dataset.overflow = "true";
      else delete viewport.dataset.overflow;
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span ref={viewportRef} className={cn("hover-marquee", className)} title={text}>
      <span className="hover-marquee-static">{text}</span>
      <span ref={trackRef} className="hover-marquee-track" aria-hidden="true">{text}</span>
    </span>
  );
}

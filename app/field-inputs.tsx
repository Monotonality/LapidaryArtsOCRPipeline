"use client";

import { useEffect, type InputHTMLAttributes, type RefObject } from "react";
import {
  DATE_PLACEHOLDER,
  STATUS_TEXT,
  formatDateInput,
  type FieldStatus,
} from "@/lib/record-fields";

/**
 * The N/A and Invalid ticks shown in each field's header. They are mutually
 * exclusive: ticking one clears the other.
 */
export function FieldStatusTicks({
  status,
  onChange,
  className,
}: {
  status: FieldStatus;
  onChange: (next: FieldStatus) => void;
  className?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: "0.75rem" }}>
      {(["na", "invalid"] as const).map((kind) => (
        <span key={kind} className={className}>
          <input
            type="checkbox"
            checked={status === kind}
            onChange={() => onChange(status === kind ? "value" : kind)}
          />
          {STATUS_TEXT[kind]}
        </span>
      ))}
    </span>
  );
}

/**
 * Typed date input (no calendar picker). Keeps the value in MM-DD-YY,
 * inserting hyphens as the user types.
 */
export function DateInput({
  value,
  onValueChange,
  placeholder,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      pattern="\d{2}-\d{2}-\d{2}"
      title="Type the date as MM-DD-YY"
      placeholder={placeholder ?? DATE_PLACEHOLDER}
      value={value}
      onChange={(e) => onValueChange(formatDateInput(e.target.value))}
    />
  );
}

/**
 * Mobile browsers scroll the focused field back into view on every keystroke.
 * When the user has deliberately scrolled the field out of view (for example
 * up to the photo), keep the page where they put it while they type.
 */
export function useKeepScrollWhileTyping(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let saved: { x: number; y: number; until: number } | null = null;

    const fieldOutOfView = (el: Element) => {
      const vv = window.visualViewport;
      const top = vv ? vv.offsetTop : 0;
      const bottom = top + (vv ? vv.height : window.innerHeight);
      const rect = el.getBoundingClientRect();
      return rect.bottom <= top || rect.top >= bottom;
    };

    const restore = () => {
      if (!saved) return;
      if (Date.now() > saved.until) {
        saved = null;
        return;
      }
      if (window.scrollX !== saved.x || window.scrollY !== saved.y) {
        window.scrollTo(saved.x, saved.y);
      }
    };

    const onBeforeInput = (event: Event) => {
      const el = event.target;
      if (
        !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) ||
        !fieldOutOfView(el)
      ) {
        saved = null;
        return;
      }
      saved = { x: window.scrollX, y: window.scrollY, until: Date.now() + 300 };
    };

    // A finger on the screen means the user is scrolling on purpose.
    const release = () => {
      saved = null;
    };

    const onInput = () => {
      if (!saved) return;
      restore();
      requestAnimationFrame(restore);
    };

    root.addEventListener("beforeinput", onBeforeInput, true);
    root.addEventListener("input", onInput, true);
    window.addEventListener("scroll", restore, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("wheel", release, { passive: true });
    return () => {
      root.removeEventListener("beforeinput", onBeforeInput, true);
      root.removeEventListener("input", onInput, true);
      window.removeEventListener("scroll", restore);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("wheel", release);
    };
  }, [ref]);
}

import { useEffect } from "react";

type ShortcutHandler = (e: KeyboardEvent) => void;

interface Shortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch =
          e.key.toLowerCase() === shortcut.key.toLowerCase() ||
          e.code.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch) {
          const target = e.target as HTMLElement;
          const isInput =
            target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

          const shouldFireInInput = shortcut.key === "Escape" || shortcut.meta || shortcut.ctrl;

          if (!isInput || shouldFireInInput) {
            e.preventDefault();
            e.stopPropagation();
            shortcut.handler(e);
            return;
          }
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}

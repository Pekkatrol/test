import { useEffect } from "react";

// Bloque copier / couper / coller / glisser-déposer / menu contextuel sur tout le site.
export function useNoCopyPaste() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const events = ["paste", "copy", "cut", "drop", "dragstart", "contextmenu"];

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && ["v", "c", "x"].includes(k)) || (mod && k === "insert") || (e.shiftKey && k === "insert"))
        e.preventDefault();
    };
    const onBeforeInput = (e: Event) => {
      if (/^insertFrom(Paste|Drop|Yank)/.test((e as InputEvent).inputType)) e.preventDefault();
    };

    events.forEach((n) => document.addEventListener(n, block));
    document.addEventListener("keydown", onKey);
    document.addEventListener("beforeinput", onBeforeInput);
    return () => {
      events.forEach((n) => document.removeEventListener(n, block));
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("beforeinput", onBeforeInput);
    };
  }, []);
}

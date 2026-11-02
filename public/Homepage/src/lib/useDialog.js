import { useCallback, useEffect, useRef, useState } from 'react';

// How long a popup's way out lasts; matches the leaving animations in cadence.css.
const LEAVE_MS = 200;

/**
 * Focus and Escape for a modal panel: give the returned ref to the panel, with
 * tabIndex={-1}. It focuses the panel rather than a button, because focusing
 * one lower down would scroll past the title on a phone.
 */
export function useDialog(onClose) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return panelRef;
}

/**
 * Lets a popup play its way out before it unmounts: `leave(then)` marks it
 * leaving, then calls `then` once the animation has run. With reduced motion
 * there's nothing to wait for.
 */
export function useLeave() {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const leave = useCallback((then) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      then();
      return;
    }
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(then, LEAVE_MS);
  }, []);

  return [leaving, leave];
}

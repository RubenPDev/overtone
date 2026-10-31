import { useEffect, useRef } from 'react';

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

import React, { useEffect, useRef } from 'react';
import ArchiveList from './ArchiveList.jsx';

export default function ArchiveDrawer({ open, onClose, current, onPick, List = ArchiveList }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center' });
    }
  }, [open, current]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`arch__scrim${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`arch${open ? ' is-open' : ''}`} aria-label="Puzzle archive">
        <div className="arch__head">
          <span className="arch__title">Archive</span>
          <button type="button" className="arch__close" onClick={onClose} aria-label="Close archive">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <List current={current} onPick={onPick} activeRef={activeRef} refresh={open} />

        <p className="arch__foot">
          This is where you can revisit past puzzles — scroll to see more.
        </p>
      </aside>
    </>
  );
}

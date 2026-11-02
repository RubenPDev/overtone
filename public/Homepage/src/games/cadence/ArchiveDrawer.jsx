import React, { useEffect, useRef } from 'react';
import ArchiveList from './ArchiveList.jsx';
import LikeCount from '../../components/LikeCount.jsx';
import { devMode } from '../../lib/devMode.js';

/* `finished` changes once a result has been saved, which re-reads the list. */
export default function ArchiveDrawer({ open, onClose, current, onPick, finished, List = ArchiveList }) {
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

        <List current={current} onPick={onPick} activeRef={activeRef} refresh={`${open}/${finished}`} />

        <div className="arch__foot">
          <p>This is where you can revisit past puzzles — scroll to see more.</p>
          {devMode() && <p className="arch__dev">Developer mode: previews of future days are listed, and playing them sends no stats.</p>}
          <LikeCount />
        </div>
      </aside>
    </>
  );
}

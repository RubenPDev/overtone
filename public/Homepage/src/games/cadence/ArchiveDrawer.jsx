import React, { useEffect, useMemo, useRef } from 'react';
import { archiveList, characterOf, difficultyOf, todayNumber } from './melodies.js';
import { readResults } from '../../lib/progress.js';

const STATE_LABEL = {
  solved: 'Solved by ear',
  assisted: 'Solved after hearing it',
  missed: 'Played',
};

function fmtDate(d) {
  // Puzzle dates are UTC midnights; local time would show the day before in the Americas.
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function ArchiveDrawer({ open, onClose, current, onPick }) {
  const puzzles = useMemo(() => archiveList(), [open]);
  const results = useMemo(() => readResults('cadence'), [open]);
  const today = todayNumber();
  const listRef = useRef(null);
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

        <ol className="arch__list" ref={listRef}>
          {puzzles.map((p) => {
            const state = results[p.number];
            const isCurrent = p.number === current;
            const isToday = p.number === today;
            return (
              <li key={p.number}>
                <button
                  type="button"
                  ref={isCurrent ? activeRef : null}
                  className={`arch__item${isCurrent ? ' is-current' : ''}`}
                  onClick={() => onPick(p.number)}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`Puzzle ${p.number}, ${fmtDate(p.date)}${state ? `, ${STATE_LABEL[state].toLowerCase()}` : ''}`}
                >
                  <span
                    className={`arch__dot arch__dot--${state || 'none'}`}
                    title={state ? STATE_LABEL[state] : undefined}
                    aria-hidden="true"
                  />
                  <span className="arch__no">#{p.number}</span>
                  <span className="arch__meta">
                    <span className="arch__date">{fmtDate(p.date)}{isToday ? ' · today' : ''}</span>
                    <span className="arch__tune">
                      {state
                        ? p.melody.title
                        : `${difficultyOf(p.melody)} · ${characterOf(p.melody)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <p className="arch__foot">
          This is where you can revisit past puzzles — scroll to see more.
        </p>
      </aside>
    </>
  );
}

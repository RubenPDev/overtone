import React, { useMemo } from 'react';
import { archiveList, characterOf, difficultyOf, puzzlePath, todayNumber } from './melodies.js';
import { readResults } from '../../lib/progress.js';
import { linkHandler, withBase } from '../../router.js';

const STATE_LABEL = {
  solved: 'Solved by ear',
  assisted: 'Solved after hearing it',
  missed: 'Played',
};

function fmtDate(d) {
  // Puzzle dates are UTC midnights; local time would show the day before in the Americas.
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Tune names stay hidden until that puzzle has been played. `refresh` re-reads the list when it changes. */
export default function ArchiveList({ current, onPick, activeRef, refresh }) {
  const puzzles = useMemo(() => archiveList(), [refresh]);
  const results = useMemo(() => readResults('cadence'), [refresh]);
  const today = todayNumber();

  return (
    <ol className="arch__list">
      {puzzles.map((p) => {
        const state = results[p.number];
        const isCurrent = p.number === current;
        const isToday = p.number === today;
        const path = puzzlePath(p.number);
        return (
          <li key={p.number}>
            <a
              href={withBase(path)}
              ref={isCurrent ? activeRef : null}
              className={`arch__item${isCurrent ? ' is-current' : ''}`}
              onClick={linkHandler(() => onPick(p.number), path)}
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
            </a>
          </li>
        );
      })}
    </ol>
  );
}

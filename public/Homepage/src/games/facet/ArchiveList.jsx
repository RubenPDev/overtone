import React, { useMemo } from 'react';
import { dateForNumber, parFor, puzzlePath, todayNumber } from './solver.js';
import { readBest, readResults } from '../../lib/progress.js';
import { linkHandler, withBase } from '../../router.js';

function fmtDate(d) {
  // Puzzle dates are UTC midnights; local time would show the day before in the Americas.
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** `refresh` re-reads the list when it changes. */
export default function ArchiveList({ current, onPick, activeRef, refresh }) {
  const results = useMemo(() => readResults('facet'), [refresh]);
  const best = useMemo(() => readBest('facet'), [refresh]);
  const today = todayNumber();
  const numbers = Array.from({ length: today }, (_, i) => today - i);

  return (
    <ol className="arch__list">
      {numbers.map((n) => {
        const state = results[n];
        const isCurrent = n === current;
        const path = puzzlePath(n);
        const par = parFor(n);
        return (
          <li key={n}>
            <a
              href={withBase(path)}
              ref={isCurrent ? activeRef : null}
              className={`arch__item${isCurrent ? ' is-current' : ''}`}
              onClick={linkHandler(() => onPick(n), path)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Puzzle ${n}, ${fmtDate(dateForNumber(n))}${state ? ', solved' : ''}`}
            >
              <span className={`arch__dot arch__dot--${state || 'none'}`} aria-hidden="true" />
              <span className="arch__no">#{n}</span>
              <span className="arch__meta">
                <span className="arch__date">{fmtDate(dateForNumber(n))}{n === today ? ' · today' : ''}</span>
                <span className="arch__tune">
                  {best[n] !== undefined ? `Best ${best[n]} · par ${par}` : `Par ${par}`}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

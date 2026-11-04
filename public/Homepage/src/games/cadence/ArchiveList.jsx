import React, { useMemo } from 'react';
import { archiveList, characterOf, difficultyOf, puzzlePath, todayNumber } from './melodies.js';
import { readResults } from '../../lib/progress.js';
import { linkHandler, withBase } from '../../router.js';
import { locale, t, tx } from '../../lib/i18n.js';
import { tuneText } from './text.js';

const STATE_LABEL = {
  solved: tx('Solved by ear'),
  assisted: tx('Solved after hearing it'),
  missed: tx('Played'),
};

function fmtDate(d) {
  // Puzzle dates are UTC midnights; local time would show the day before in the Americas.
  return d.toLocaleDateString(locale(), { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Tune names stay hidden until that puzzle has been played, except ahead of their day in developer
    mode, where knowing which tune it is is the point. `refresh` re-reads the list when it changes. */
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
        const ahead = p.number > today;
        const path = puzzlePath(p.number);
        return (
          <li key={p.number}>
            <a
              href={withBase(path)}
              ref={isCurrent ? activeRef : null}
              className={`arch__item${isCurrent ? ' is-current' : ''}`}
              onClick={linkHandler(() => onPick(p.number), path)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`${t('Puzzle {n}', { n: p.number })}, ${fmtDate(p.date)}${state ? `, ${t(STATE_LABEL[state]).toLowerCase()}` : ''}`}
            >
              <span
                className={`arch__dot arch__dot--${state || 'none'}`}
                title={state ? t(STATE_LABEL[state]) : undefined}
                aria-hidden="true"
              />
              <span className="arch__no">#{p.number}</span>
              <span className="arch__meta">
                <span className="arch__date">{fmtDate(p.date)}{isToday ? ` · ${t('today')}` : ahead ? ` · ${t('preview')}` : ''}</span>
                <span className="arch__tune">
                  {state || ahead
                    ? tuneText(p.melody).title
                    : `${t(difficultyOf(p.melody))} · ${t(characterOf(p.melody))}`}
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

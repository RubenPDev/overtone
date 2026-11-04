import React, { useMemo } from 'react';
import { dateForNumber, lastNumber, puzzlePath, todayNumber } from './puzzles.js';
import { readResults } from '../../lib/progress.js';
import { linkHandler, withBase } from '../../router.js';
import { locale, t, tx } from '../../lib/i18n.js';

function fmtDate(d) {
  // Puzzle dates are UTC midnights; local time would show the day before in the Americas.
  return d.toLocaleDateString(locale(), { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const STATE_LABEL = { solved: tx('Perfect flow'), assisted: tx('Every car through') };

/** `refresh` re-reads the list when it changes. */
export default function ArchiveList({ current, onPick, activeRef, refresh }) {
  const results = useMemo(() => readResults('junctions'), [refresh]);
  const today = todayNumber();
  const last = lastNumber();
  const numbers = Array.from({ length: last }, (_, i) => last - i);

  return (
    <ol className="arch__list">
      {numbers.map((n) => {
        const state = results[n];
        const isCurrent = n === current;
        const path = puzzlePath(n);
        return (
          <li key={n}>
            <a
              href={withBase(path)}
              ref={isCurrent ? activeRef : null}
              className={`arch__item${isCurrent ? ' is-current' : ''}`}
              onClick={linkHandler(() => onPick(n), path)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`${t('Puzzle {n}', { n })}, ${fmtDate(dateForNumber(n))}${state ? `, ${STATE_LABEL[state] ? t(STATE_LABEL[state]) : t('played')}` : ''}`}
            >
              <span className={`arch__dot arch__dot--${state || 'none'}`} aria-hidden="true" />
              <span className="arch__no">#{n}</span>
              <span className="arch__meta">
                <span className="arch__date">{fmtDate(dateForNumber(n))}{n === today ? ` · ${t('today')}` : n > today ? ` · ${t('preview')}` : ''}</span>
                <span className="arch__tune">{STATE_LABEL[state] ? t(STATE_LABEL[state]) : t('Not cleared yet')}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

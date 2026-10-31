import React, { useEffect, useMemo, useState } from 'react';
import { readResults, readStreak, readTries } from '../../lib/progress.js';
import { reportShare } from '../../lib/stats.js';
import { useDialog } from '../../lib/useDialog.js';
import { withBase } from '../../router.js';

const ICONS = {
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
  ear: <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />,
  headphones: <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  retry: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
};

export function ResultIcon({ name }) {
  return <svg className="cad-result__icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[name]}</svg>;
}

// A row has a mark for each gap; the last note has no gap after it, so it's always fine.
const withLastNote = (row) => [...row, 0];
const EMOJI = { 0: '🟩', [-1]: '🟧', 1: '🟥' };

function triesLabel(count) {
  return count === 1 ? 'first try' : `${count} tries`;
}

/** Colours say only right, short or long, so sharing never gives away the tune. */
function shareText(number, outcome, tries) {
  const how = outcome === 'assisted' ? 'with help' : 'by ear';
  return [
    `Cadence #${number}: solved ${how}${tries ? `, ${triesLabel(tries.count)}` : ''}`,
    ...(tries ? tries.rows.map((row) => withLastNote(row).map((m) => EMOJI[m]).join('')) : []),
    `${window.location.origin}${withBase(`/cadence/${number}`)}?via=share`,
  ].join('\n');
}

async function share(text) {
  // Phones get the system share sheet; on a desktop, copying is what people expect.
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    await navigator.share({ text });
    reportShare('sheet');
    return null;
  }
  await navigator.clipboard.writeText(text);
  reportShare('copy');
  return 'Copied!';
}

export default function CadenceResult({ ns, puzzle, onClose, onReplay }) {
  const { number, date, melody } = puzzle;
  const panelRef = useDialog(onClose);
  const outcome = useMemo(() => readResults(ns)[number], [ns, number]);
  const tries = useMemo(() => readTries(ns, number), [ns, number]);
  const streak = useMemo(() => readStreak(ns), [ns]);
  const [shareLabel, setShareLabel] = useState(null);

  useEffect(() => {
    if (!shareLabel) return undefined;
    const t = setTimeout(() => setShareLabel(null), 2200);
    return () => clearTimeout(t);
  }, [shareLabel]);

  const onShare = () => {
    share(shareText(number, outcome, tries))
      .then(setShareLabel)
      .catch((e) => {
        // Closing the share sheet isn't a failure.
        if (e?.name !== 'AbortError') setShareLabel('Couldn’t copy');
      });
  };

  const assisted = outcome === 'assisted';
  const firstTry = !assisted && tries?.count === 1;
  const heading = assisted ? 'Solved, with help' : firstTry ? 'First try!' : 'Solved by ear';
  const badge = assisted ? 'headphones' : firstTry ? 'star' : 'ear';
  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="cad-help" onClick={onClose}>
      <div
        className="cad-help__panel cad-result"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cad-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="arch__close cad-result__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className={`cad-result__badge${assisted ? ' is-assisted' : ''}`}><ResultIcon name={badge} /></div>
        <h2 className="cad-result__title" id="cad-result-title">{heading}</h2>
        <p className="cad-result__meta">Cadence #{number} · {dateLabel}</p>

        <p className="cad-result__tune"><b>{melody.title}</b> · {melody.composer}</p>
        <p className="cad-result__note">{melody.solved}</p>

        <dl className="cad-result__tiles">
          <div>
            <ResultIcon name="retry" />
            <dd>{tries ? tries.count : '—'}</dd>
            <dt>{tries?.count === 1 ? 'Try' : 'Tries'}</dt>
          </div>
          <div>
            <ResultIcon name={assisted ? 'headphones' : 'ear'} />
            <dd>{assisted ? 'Yes' : 'No'}</dd>
            <dt>Help</dt>
          </div>
          <div>
            <ResultIcon name="flame" />
            <dd>{streak}</dd>
            <dt>Day streak</dt>
          </div>
        </dl>

        {tries && tries.rows.length > 0 && (
          <div className="cad-result__rows" aria-hidden="true">
            {tries.rows.map((row, r) => (
              <div className="cad-result__row" key={r}>
                {withLastNote(row).map((m, k) => (
                  <span key={k} className={m === 0 ? 'is-ok' : m === -1 ? 'is-short' : 'is-long'} />
                ))}
              </div>
            ))}
          </div>
        )}
        {tries && tries.count > tries.rows.length && (
          <p className="cad-result__more">Your last {tries.rows.length} of {tries.count} tries</p>
        )}

        <div className="cad-help__actions">
          <button type="button" className="cad__btn cad__btn--primary" onClick={onShare} aria-live="polite">
            {shareLabel || 'Share'}
          </button>
          <button type="button" className="cad__btn" onClick={onReplay}>Play again</button>
        </div>
      </div>
    </div>
  );
}

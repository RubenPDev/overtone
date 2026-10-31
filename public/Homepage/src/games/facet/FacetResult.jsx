import React, { useEffect, useMemo, useState } from 'react';
import { ResultIcon, share } from '../cadence/CadenceResult.jsx';
import { readBest, readStreak } from '../../lib/progress.js';
import { useDialog } from '../../lib/useDialog.js';
import { withBase } from '../../router.js';
import { dateForNumber, parFor } from './solver.js';

function shareText(number, best, par) {
  return [
    `Facet #${number}: ${best} moves, par ${par}`,
    `${window.location.origin}${withBase(`/facet/${number}`)}?via=share`,
  ].join('\n');
}

export default function FacetResult({ ns, number, onClose, onReplay }) {
  const panelRef = useDialog(onClose);
  const best = useMemo(() => readBest(ns)[number], [ns, number]);
  const streak = useMemo(() => readStreak(ns), [ns]);
  const par = parFor(number);
  const [shareLabel, setShareLabel] = useState(null);

  useEffect(() => {
    if (!shareLabel) return undefined;
    const t = setTimeout(() => setShareLabel(null), 2200);
    return () => clearTimeout(t);
  }, [shareLabel]);

  const onShare = () => {
    share(shareText(number, best, par))
      .then(setShareLabel)
      .catch((e) => {
        // Closing the share sheet isn't a failure.
        if (e?.name !== 'AbortError') setShareLabel('Couldn’t copy');
      });
  };

  const atPar = best === par;
  const dateLabel = dateForNumber(number).toLocaleDateString(undefined, {
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
        aria-labelledby="fc-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="arch__close cad-result__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className="cad-result__badge"><ResultIcon name={atPar ? 'star' : 'retry'} /></div>
        <h2 className="cad-result__title" id="fc-result-title">{atPar ? 'Exactly par!' : 'Solved'}</h2>
        <p className="cad-result__meta">Facet #{number} · {dateLabel}</p>

        <p className="cad-result__note">
          {atPar
            ? 'No shorter route exists. The search proved it before you started.'
            : 'Finishing is the easy half. The puzzle is the route.'}
        </p>

        <dl className="cad-result__tiles">
          <div>
            <ResultIcon name="retry" />
            <dd>{best ?? '—'}</dd>
            <dt>Best</dt>
          </div>
          <div>
            <ResultIcon name="star" />
            <dd>{par}</dd>
            <dt>Par</dt>
          </div>
          <div>
            <ResultIcon name="flame" />
            <dd>{streak}</dd>
            <dt>Day streak</dt>
          </div>
        </dl>

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

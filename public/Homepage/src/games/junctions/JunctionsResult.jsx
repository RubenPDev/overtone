import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DonateLink from '../../components/DonateLink.jsx';
import { ResultIcon, share } from '../cadence/CadenceResult.jsx';
import { readResults, readStreak, readTries } from '../../lib/progress.js';
import { useDialog, useLeave } from '../../lib/useDialog.js';
import { withBase } from '../../router.js';
import { dateForNumber } from './puzzles.js';
import { costOf } from './sim.js';

const EMOJI = { lights: '🚦', roundabout: '🔄', flyover: '🌉' };

function shareText(number, perfect, tries, config, budget) {
  const built = Object.values(config).sort().map((t) => EMOJI[t]).join('') || 'nothing';
  const how = perfect ? 'perfect flow' : 'cleared';
  const count = tries ? (tries.count === 1 ? ', first try' : `, ${tries.count} tries`) : '';
  return [
    `Junctions #${number}: ${how}${count}`,
    `${built} $${costOf(config)} of $${budget}`,
    `${window.location.origin}${withBase(`/junctions/${number}`)}?via=share`,
  ].join('\n');
}

export default function JunctionsResult({ ns, number, budget, config, onClose, onReplay }) {
  const [leaving, leave] = useLeave();
  const close = useCallback(() => leave(onClose), [leave, onClose]);
  const panelRef = useDialog(close);
  const outcome = useMemo(() => readResults(ns)[number], [ns, number]);
  const tries = useMemo(() => readTries(ns, number), [ns, number]);
  const streak = useMemo(() => readStreak(ns), [ns]);
  const [shareLabel, setShareLabel] = useState(null);
  const perfect = outcome === 'solved';
  // The share of cars that got through on the run that solved it, kept with the tries.
  const cleared = perfect ? 100 : tries?.done ? tries.rows[tries.rows.length - 1]?.[0] : undefined;

  useEffect(() => {
    if (!shareLabel) return undefined;
    const t = setTimeout(() => setShareLabel(null), 2200);
    return () => clearTimeout(t);
  }, [shareLabel]);

  const onShare = () => {
    share(shareText(number, perfect, tries, config, budget), 'junctions')
      .then(setShareLabel)
      .catch((e) => {
        // Closing the share sheet isn't a failure.
        if (e?.name !== 'AbortError') setShareLabel('Couldn’t copy');
      });
  };

  const dateLabel = dateForNumber(number).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className={`cad-help cad-help--result${leaving ? ' is-leaving' : ''}`} onClick={close}>
      <div
        className="cad-help__panel cad-result"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="jn-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="arch__close cad-result__close" onClick={close} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className={`cad-result__badge${perfect ? '' : ' is-assisted'}`}><ResultIcon name={perfect ? 'star' : 'retry'} /></div>
        <h2 className="cad-result__title" id="jn-result-title">{perfect ? 'Perfect flow!' : 'Traffic cleared'}</h2>
        <p className="cad-result__meta">Junctions #{number} · {dateLabel}</p>

        <p className="cad-result__note">
          {perfect
            ? 'Every car got through, and not one street went red.'
            : 'Most of the town got where it was going. Keep every street out of the red for a perfect flow.'}
        </p>

        <dl className="cad-result__tiles cad-result__tiles--four">
          <div>
            <ResultIcon name="car" />
            <dd>{cleared === undefined ? '—' : `${cleared}%`}</dd>
            <dt>Cleared</dt>
          </div>
          <div>
            <ResultIcon name="retry" />
            <dd>{tries ? tries.count : '—'}</dd>
            <dt>{tries?.count === 1 ? 'Run' : 'Runs'}</dt>
          </div>
          <div>
            <ResultIcon name="star" />
            <dd>${costOf(config)}</dd>
            <dt>of ${budget} spent</dt>
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
          <button type="button" className="cad__btn" onClick={() => leave(onReplay)}>Play again</button>
        </div>

        <DonateLink quiet />
      </div>
    </div>
  );
}

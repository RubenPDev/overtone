import React, { useRef } from 'react';
import Glyph from './Glyph.jsx';
import { helpSeen } from '../lib/progress.js';
import { useGameStats } from '../lib/useGameStats.js';
import { linkHandler, withBase } from '../router.js';
import { t } from '../lib/i18n.js';

function Streak({ n }) {
  if (!n) return null;
  return <span className="card__streak">{n === 1 ? t('1 day') : t('{n} days', { n })}</span>;
}

export default function GameCard({ game, featured = false, navigate }) {
  const stats = useGameStats(game.storageKey);
  const live = game.status === 'live';
  const markRef = useRef(null);

  /* The mark morphs into the game's pad. A named element whose partner never turns
     up is still drawn above the whole page while it fades, so it's named only as
     this card is followed, and only when the game will open uncovered: not on a
     first visit (How to play) or once played today (the result). */
  const follow = (e) => {
    linkHandler(navigate, game.href)(e);
    if (e.defaultPrevented && game.morph && helpSeen(game.storageKey) && !stats.played) {
      markRef.current.style.viewTransitionName = `mark-${game.id}`;
    }
  };

  const Wrapper = live ? 'a' : 'div';
  const props = live
    ? { href: withBase(game.href), onClick: follow }
    : { 'aria-disabled': 'true' };

  /* The featured card keeps this under its description; the smaller ones run it
     the whole width of the card, below the mark, so it stays on one line. */
  const foot = (
    <div className="card__foot">
      {live ? (
        <>
          <span className="card__cta">
            {stats.played ? t('See today’s result') : t('Play')}
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <Streak n={stats.streak} />
        </>
      ) : (
        <span className="card__cta card__cta--muted">{t('In the workshop')}</span>
      )}
    </div>
  );

  return (
    <Wrapper
      {...props}
      className={`card${featured ? ' card--featured' : ''}${live ? '' : ' card--soon'}`}
      style={{ '--accent': game.accent }}
    >
      <div className="card__mark" ref={markRef}>
        <Glyph kind={game.glyph} className="card__glyph" />
      </div>

      <div className="card__body">
        <div className="card__heading">
          <h3 className="card__name">{game.name}</h3>
          {live ? (
            stats.played
              ? <span className="card__badge card__badge--done">{t('Played today')}</span>
              : <span className="card__badge">{t('New today')}</span>
          ) : (
            <span className="card__badge card__badge--soon">{t('Soon')}</span>
          )}
        </div>

        <p className="card__tagline">{t(game.tagline)}</p>
        {featured && <p className="card__desc">{t(game.description)}</p>}
        {featured && foot}
      </div>
      {!featured && foot}
    </Wrapper>
  );
}

import React from 'react';
import Glyph from './Glyph.jsx';
import { useGameStats } from '../lib/useGameStats.js';
import { linkHandler } from '../router.js';

function Streak({ n }) {
  if (!n) return null;
  return <span className="card__streak">{n} day{n === 1 ? '' : 's'}</span>;
}

export default function GameCard({ game, featured = false, navigate }) {
  const stats = useGameStats(game.storageKey);
  const live = game.status === 'live';

  const Wrapper = live ? 'a' : 'div';
  const props = live
    ? { href: game.href, onClick: linkHandler(navigate, game.href) }
    : { 'aria-disabled': 'true' };

  return (
    <Wrapper
      {...props}
      className={`card${featured ? ' card--featured' : ''}${live ? '' : ' card--soon'}`}
      style={{ '--accent': game.accent }}
    >
      {/* Shares a view-transition-name with the game's pad, so the browser
          morphs this ring into the oscilloscope on navigation. */}
      <div
        className="card__mark"
        style={live ? { viewTransitionName: `mark-${game.id}` } : undefined}
      >
        <Glyph kind={game.glyph} className="card__glyph" />
      </div>

      <div className="card__body">
        <div className="card__heading">
          <h3 className="card__name">{game.name}</h3>
          {live ? (
            stats.played
              ? <span className="card__badge card__badge--done">Played today</span>
              : <span className="card__badge">New today</span>
          ) : (
            <span className="card__badge card__badge--soon">Soon</span>
          )}
        </div>

        <p className="card__tagline">{game.tagline}</p>
        {featured && <p className="card__desc">{game.description}</p>}

        <div className="card__foot">
          {live ? (
            <>
              <span className="card__cta">
                {stats.played ? 'See today’s result' : 'Play'}
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <Streak n={stats.streak} />
            </>
          ) : (
            <span className="card__cta card__cta--muted">In the workshop</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

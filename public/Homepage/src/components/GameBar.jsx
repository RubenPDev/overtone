import React from 'react';
import { BrandMark, SettingsMenu } from './Header.jsx';
import { t } from '../lib/i18n.js';
import { linkHandler, withBase } from '../router.js';

/** What sits at the top of a game: the way home, and its pill of small buttons. */
export default function GameBar({ onNavigate, children }) {
  return (
    <header className="gamebar">
      <a className="brand" href={withBase('/')} onClick={linkHandler(onNavigate, '/')} aria-label={t('Back to all games')}>
        <BrandMark />
        <span className="brand__word">Overtone</span>
      </a>
      <div className="pillbar">
        {children}
        <SettingsMenu className="pillbar__btn pillbar__btn--theme" />
      </div>
    </header>
  );
}

/** The arrows walk day by day; the number in the middle opens the whole archive. */
export function PuzzleStepper({ number, last, onPick, onOpenArchive }) {
  return (
    <div className="stepper">
      <button type="button" className="stepper__arrow" onClick={() => onPick(number - 1)} disabled={number <= 1} aria-label={t('Previous puzzle')}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className="stepper__now" onClick={onOpenArchive} aria-label={t('Open archive')} title={t('Open archive')}>
        #{number}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="stepper__arrow" onClick={() => onPick(number + 1)} disabled={number >= last} aria-label={t('Next puzzle')}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 5L4.5 9l4 4" />
      <path d="M4.5 9H14a5.5 5.5 0 0 1 0 11H9" />
    </svg>
  );
}

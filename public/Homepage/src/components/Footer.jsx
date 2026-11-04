import React from 'react';
import DonateLink from './DonateLink.jsx';
import { linkHandler, withBase } from '../router.js';
import { GAMES } from '../data/games.js';
import { t } from '../lib/i18n.js';

export default function Footer({ navigate }) {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" id="footer">
      <div className="footer__grid">
        <div className="footer__col">
          <h4>{t('Games')}</h4>
          <ul>
            {GAMES.map((g) => (
              <li key={g.id}>
                {g.status === 'live' ? (
                  <a href={withBase(g.href)} onClick={navigate ? linkHandler(navigate, g.href) : undefined}>{g.name}</a>
                ) : (
                  <span className="footer__muted">{g.name} — {t('soon')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col">
          <h4>{t('Site')}</h4>
          <ul>
            <li><a href={withBase('/#about')}>{t('About')}</a></li>
            <li><a href={withBase('/archive')} onClick={navigate ? linkHandler(navigate, '/archive') : undefined}>{t('Archive')}</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>{t('Elsewhere')}</h4>
          <ul>
            <li><a href="mailto:contact@overtone.games">{t('Email')}</a></li>
            <li><a href="https://x.com/overtonegames" target="_blank" rel="noopener noreferrer">X</a></li>
            <li><a href={withBase('/privacy')} onClick={navigate ? linkHandler(navigate, '/privacy') : undefined}>{t('Privacy')}</a></li>
          </ul>
        </div>
      </div>

      <DonateLink />

      <div className="footer__base">
        <p>© {year} Overtone. {t('All melodies are in the public domain.')}</p>
        <p className="footer__note">{t('Scroll up, you nosy bugger.')}</p>
      </div>
    </footer>
  );
}

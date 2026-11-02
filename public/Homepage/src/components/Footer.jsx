import React from 'react';
import DonateLink from './DonateLink.jsx';
import { linkHandler, withBase } from '../router.js';
import { GAMES } from '../data/games.js';

export default function Footer({ navigate }) {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" id="footer">
      <div className="footer__grid">
        <div className="footer__col">
          <h4>Games</h4>
          <ul>
            {GAMES.map((g) => (
              <li key={g.id}>
                {g.status === 'live' ? (
                  <a href={withBase(g.href)} onClick={navigate ? linkHandler(navigate, g.href) : undefined}>{g.name}</a>
                ) : (
                  <span className="footer__muted">{g.name} — soon</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="footer__col">
          <h4>Site</h4>
          <ul>
            <li><a href={withBase('/#about')}>About</a></li>
            <li><a href={withBase('/archive')} onClick={navigate ? linkHandler(navigate, '/archive') : undefined}>Archive</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Elsewhere</h4>
          <ul>
            <li><a href="mailto:contact@overtone.games">Email</a></li>
            <li><a href="https://x.com/overtonegames" target="_blank" rel="noopener noreferrer">X</a></li>
            <li><a href={withBase('/privacy')} onClick={navigate ? linkHandler(navigate, '/privacy') : undefined}>Privacy</a></li>
          </ul>
        </div>
      </div>

      <DonateLink />

      <div className="footer__base">
        <p>© {year} Overtone. All melodies are in the public domain.</p>
        <p className="footer__note">Scroll up, you nosy bugger.</p>
      </div>
    </footer>
  );
}

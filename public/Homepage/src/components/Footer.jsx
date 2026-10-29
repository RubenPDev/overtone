import React from 'react';
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
            <li><a href="#about">About</a></li>
            <li><a href="/how-to-play/">How to play</a></li>
            <li><a href="/archive/">Archive</a></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Elsewhere</h4>
          <ul>
            <li><a href="mailto:hello@overtone.games">Email</a></li>
            <li><a href="/privacy/">Privacy</a></li>
            <li><a href="/credits/">Credits</a></li>
          </ul>
        </div>
      </div>

      <div className="footer__base">
        <p>© {year} Overtone. All melodies are in the public domain.</p>
        <p className="footer__note">Made with more patience than sense.</p>
      </div>
    </footer>
  );
}

import React from 'react';
import { t } from '../lib/i18n.js';

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about__head">
        <span className="eyebrow">{t('About')}</span>
        <h2>{t('Small puzzles, played by ear.')}</h2>
      </div>

      <div className="about__cols">
        <div className="about__col">
          <p>
            {t('Overtone is a handful of daily games, most of them about hearing. Each one takes a minute or two, arrives once a day, and is the same for everyone who plays it.')}
          </p>
          <p>
            {t('There is no account, no app to install, and nothing to subscribe to. Your streak lives in your own browser, which means clearing your data loses it — a trade we made deliberately. We do keep count of how the games are played, under a random ID that isn’t tied to your name or address, so we can see which puzzles are too hard and whether people come back. The privacy page has the details, and a switch to turn it off.')}
          </p>
        </div>

        <div className="about__col">
          <p>
            {t('Every melody is in the public domain. Nothing here is a recording: the notes are synthesised in your browser the moment you tap, which is why it works offline and loads in under a second on a bad connection.')}
          </p>
          <p>
            {t('Built by one person, slowly. If something sounds wrong or breaks on your phone,')}{' '}
            <a href="mailto:contact@overtone.games">{t('write in')}</a> — {t('it genuinely helps.')}
          </p>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>{t('Puzzle rollover')}</dt>
          <dd>{t('Midnight UTC, so everyone plays the same one at once')}</dd>
        </div>
        <div>
          <dt>{t('Accounts')}</dt>
          <dd>{t('None, ever')}</dd>
        </div>
        <div>
          <dt>{t('Price')}</dt>
          <dd>{t('Free')}</dd>
        </div>
      </dl>
    </section>
  );
}

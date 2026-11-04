import React, { useState } from 'react';
import { setStatsEnabled, statsEnabled, statsId } from '../lib/stats.js';
import { t } from '../lib/i18n.js';

/* The switch that stops this browser sending stats, and its ID for a deletion request. */
function StatsSwitch() {
  const [on, setOn] = useState(statsEnabled);
  const id = statsId();
  const toggle = () => {
    setStatsEnabled(!on);
    setOn(!on);
  };
  return (
    <div className="page__switch">
      <p>
        <strong>{on ? t('This browser sends stats.') : t('This browser doesn’t send stats.')}</strong>{' '}
        {on ? t('Turn it off and nothing more is sent from here.') : t('Nothing is sent from here until you turn it back on.')}
      </p>
      <button type="button" className="cad__btn" onClick={toggle} aria-pressed={!on}>
        {on ? t('Stop sending stats') : t('Send stats again')}
      </button>
      {id && <p className="page__id">{t('This browser’s ID:')} <code>{id}</code></p>}
    </div>
  );
}

/** A list item with a bold lead-in. */
function Item({ lead, children }) {
  return <li><strong>{lead}</strong> {children}</li>;
}

export default function Privacy() {
  return (
    <section className="page">
      <span className="eyebrow">{t('Privacy')}</span>
      <h1 className="page__title">{t('What we keep, and why.')}</h1>
      <p className="page__lede">
        {t('Overtone has no accounts, ads or cookies. Your progress stays in your browser. To see which puzzles work and whether people come back, we keep a record of how the site is used, under a random ID rather than anything that says who you are.')}
      </p>

      <div className="page__section">
        <h2>{t('Saved on your device')}</h2>
        <p>
          {t('Your results, best move counts, streak, whether you used a hint, your layouts, your theme, your language and your visualizer settings are kept in your browser’s local storage. So is a random ID for this browser, and anything waiting to be sent to us. Clearing your site data erases all of it, and we can’t restore it.')}
        </p>
      </div>

      <div className="page__section">
        <h2>{t('What we record')}</h2>
        <p>{t('Once you tap, click or scroll on a page, your browser sends us these, each with the time and its random ID:')}</p>
        <ul>
          <Item lead={t('Pages:')}>
            {t('which page or puzzle you opened, whether you’re in light or dark mode, and how long the page was on screen.')}
          </Item>
          <Item lead={t('Puzzles:')}>
            {t('when you start and finish an attempt, how it went (solved, missed, with help, how many tries, how long it took, and details such as moves, gaps right or the junctions you built), and when you start over or hear the answer.')}
          </Item>
          <Item lead={t('Now and then:')}>
            {t('whether you finished or skipped a how-to-play, when you share a result, and when you tap a game’s heart.')}
          </Item>
          <Item lead={t('Your device:')}>
            {t('phone, tablet or desktop, screen size, language, the time zone it’s set to, and the system and browser it runs.')}
          </Item>
          <Item lead={t('How you arrived:')}>
            {t('the site that sent you, such as reddit.com, but not the page or post on it.')}
          </Item>
        </ul>
        <p>
          {t('Our counter runs on Cloudflare, which works out a rough country, region, time zone and network provider from your IP address. We keep those, not the address itself. We don’t record your name, email, contacts or precise location, and the ID isn’t linked to anything outside this site.')}
        </p>
        <p>
          {t('Only we can see these records. We use them to make the games better and nothing else: they aren’t sold, shared or used for advertising.')}
        </p>
      </div>

      <div className="page__section">
        <h2>{t('Turning it off')}</h2>
        <StatsSwitch />
        <p>{t('To have this browser’s records deleted, email us the ID above and we’ll remove them.')}</p>
      </div>

      <div className="page__section">
        <h2>{t('Services we rely on')}</h2>
        <p>
          {t('As with any website, these companies receive your IP address and basic browser details when your device connects to them, and may keep logs under their own policies:')}
        </p>
        <ul>
          <li><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub Pages</a> {t('hosts the site.')}</li>
          <li><a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a> {t('runs the domain’s DNS and our counter.')}</li>
          <li><a href="https://policies.google.com/privacy">Google Fonts</a> {t('serves the typefaces.')}</li>
          <li><a href="https://www.paypal.com/webapps/mpp/ua/privacy-full">PayPal</a> {t('handles donations, but only if you follow the link to it. Nothing on this site loads from PayPal.')}</li>
        </ul>
      </div>

      <div className="page__section">
        <h2>{t('If you buy us a coffee')}</h2>
        <p>
          {t('The payment happens on PayPal, under its terms. We never see your card or bank details, but PayPal shows us your name, email address and the amount, the same as any payment you send there. We use them only for our records and to reply if you write in.')}
        </p>
      </div>

      <div className="page__section">
        <h2>{t('If you email us')}</h2>
        <p>{t('We’ll have your address and whatever you write, and we’ll use them only to reply. Ask and we’ll delete them.')}</p>
      </div>

      <div className="page__section">
        <h2>{t('Questions')}</h2>
        <p>
          {t('Write to')} <a href="mailto:contact@overtone.games">contact@overtone.games</a>. {t('If this page changes, the date below will too.')}
        </p>
        <p className="page__updated">{t('Last updated November 3, 2026.')}</p>
      </div>
    </section>
  );
}

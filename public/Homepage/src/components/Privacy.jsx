import React, { useState } from 'react';
import { setStatsEnabled, statsEnabled, statsId } from '../lib/stats.js';

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
        <strong>{on ? 'This browser sends stats.' : 'This browser doesn’t send stats.'}</strong>{' '}
        {on ? 'Turn it off and nothing more is sent from here.' : 'Nothing is sent from here until you turn it back on.'}
      </p>
      <button type="button" className="cad__btn" onClick={toggle} aria-pressed={!on}>
        {on ? 'Stop sending stats' : 'Send stats again'}
      </button>
      {id && <p className="page__id">This browser’s ID: <code>{id}</code></p>}
    </div>
  );
}

export default function Privacy() {
  return (
    <section className="page">
      <span className="eyebrow">Privacy</span>
      <h1 className="page__title">What we keep, and why.</h1>
      <p className="page__lede">
        Overtone has no accounts, ads or cookies. Your progress stays in your browser. To see
        which puzzles work and whether people come back, we keep a record of how the site is
        used, under a random ID rather than anything that says who you are.
      </p>

      <div className="page__section">
        <h2>Saved on your device</h2>
        <p>
          Your results, best move counts, streak, whether you used a hint, your layouts, your
          theme and your visualizer settings are kept in your browser’s local storage. So is a
          random ID for this browser, and anything waiting to be sent to us. Clearing your site
          data erases all of it, and we can’t restore it.
        </p>
      </div>

      <div className="page__section">
        <h2>What we record</h2>
        <p>
          Once you tap, click or scroll on a page, your browser sends us these, each with the
          time and its random ID:
        </p>
        <ul>
          <li>
            <strong>Pages:</strong> which page or puzzle you opened, whether you’re in light or
            dark mode, and how long the page was on screen.
          </li>
          <li>
            <strong>Puzzles:</strong> when you start and finish an attempt, how it went (solved,
            missed, with help, how many tries, how long it took, and details such as moves,
            gaps right or the junctions you built), and when you start over or hear the answer.
          </li>
          <li>
            <strong>Now and then:</strong> whether you finished or skipped a how-to-play, when
            you share a result, and when you tap a game’s heart.
          </li>
          <li>
            <strong>Your device:</strong> phone, tablet or desktop, screen size, language, the
            time zone it’s set to, and the system and browser it runs.
          </li>
          <li>
            <strong>How you arrived:</strong> the site that sent you, such as reddit.com, but not
            the page or post on it.
          </li>
        </ul>
        <p>
          Our counter runs on Cloudflare, which works out a rough country, region, time zone
          and network provider from your IP address. We keep those, not the address itself.
          We don’t record your name, email, contacts or precise location, and the ID isn’t
          linked to anything outside this site.
        </p>
        <p>
          Only we can see these records. We use them to make the games better and nothing
          else: they aren’t sold, shared or used for advertising.
        </p>
      </div>

      <div className="page__section">
        <h2>Turning it off</h2>
        <StatsSwitch />
        <p>
          To have this browser’s records deleted, email us the ID above and we’ll remove them.
        </p>
      </div>

      <div className="page__section">
        <h2>Services we rely on</h2>
        <p>
          As with any website, these companies receive your IP address and basic browser details
          when your device connects to them, and may keep logs under their own policies:
        </p>
        <ul>
          <li><a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub Pages</a> hosts the site.</li>
          <li><a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a> runs the domain’s DNS and our counter.</li>
          <li><a href="https://policies.google.com/privacy">Google Fonts</a> serves the typefaces.</li>
          <li><a href="https://www.paypal.com/webapps/mpp/ua/privacy-full">PayPal</a> handles donations, but only if you follow the link to it. Nothing on this site loads from PayPal.</li>
        </ul>
      </div>

      <div className="page__section">
        <h2>If you buy us a coffee</h2>
        <p>
          The payment happens on PayPal, under its terms. We never see your card or bank details,
          but PayPal shows us your name, email address and the amount, the same as any payment
          you send there. We use them only for our records and to reply if you write in.
        </p>
      </div>

      <div className="page__section">
        <h2>If you email us</h2>
        <p>
          We’ll have your address and whatever you write, and we’ll use them only to reply. Ask
          and we’ll delete them.
        </p>
      </div>

      <div className="page__section">
        <h2>Questions</h2>
        <p>
          Write to <a href="mailto:contact@overtone.games">contact@overtone.games</a>. If this page
          changes, the date below will too.
        </p>
        <p className="page__updated">Last updated November 3, 2026.</p>
      </div>
    </section>
  );
}

import React from 'react';

export default function Privacy() {
  return (
    <section className="page">
      <span className="eyebrow">Privacy</span>
      <h1 className="page__title">Very little, on purpose.</h1>
      <p className="page__lede">
        Overtone has no accounts, ads or cookies. Your progress stays in your browser, and the
        only game data we receive is an anonymous count for each puzzle.
      </p>

      <div className="page__section">
        <h2>Saved on your device</h2>
        <p>
          Your results, streak, whether you used a hint, your theme and your visualizer settings
          are kept in your browser’s local storage, along with a note of which counts below it
          has already sent. None of this is sent to us. Clearing your site data erases it, and we
          can’t restore it.
        </p>
      </div>

      <div className="page__section">
        <h2>The anonymous count</h2>
        <p>
          The first time you finish a puzzle, your browser reports the game, the puzzle number
          and that it was played. The first time you solve it, it also reports whether you did so
          with or without help. Each report just adds one to a running total. We don’t store your
          IP address, an identifier or the time, so the totals can’t be traced to you. The totals
          themselves are public.
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
          <li><a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a> runs the domain’s DNS and the counter.</li>
          <li><a href="https://policies.google.com/privacy">Google Fonts</a> serves the typefaces.</li>
        </ul>
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
        <p className="page__updated">Last updated October 31, 2026.</p>
      </div>
    </section>
  );
}

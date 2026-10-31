import React from 'react';

export default function Privacy() {
  return (
    <section className="page">
      <span className="eyebrow">Privacy</span>
      <h1 className="page__title">Very little, on purpose.</h1>
      <p className="page__lede">
        Overtone has no accounts, ads or cookies. Your progress stays in your browser, and the
        only data we collect is anonymous totals of visits, plays and players.
      </p>

      <div className="page__section">
        <h2>Saved on your device</h2>
        <p>
          Your results, streak, whether you used a hint, your theme and your visualizer settings
          are kept in your browser’s local storage, along with a note of which counts below it
          has already sent and the dates you last visited and first finished a puzzle. None of
          this is sent to us as it is. Clearing your site data erases it, and we can’t restore it.
        </p>
      </div>

      <div className="page__section">
        <h2>The anonymous counts</h2>
        <p>Your browser adds one to these running totals, and each is separate from the others:</p>
        <ul>
          <li>
            <strong>Each day you visit or finish a puzzle:</strong> whether you’re new or returning,
            and roughly how long ago you first played.
          </li>
          <li>
            <strong>Your first visit:</strong> phone or desktop, and where you came from, as one
            word from a short list such as “Reddit” or “shared link”. The actual page isn’t sent.
          </li>
          <li>
            <strong>Each puzzle:</strong> that you started and finished it, whether you solved it
            with or without help, and roughly how many tries it took.
          </li>
          <li>
            <strong>Your first finish:</strong> your country, which Cloudflare works out from your
            connection.
          </li>
          <li>
            <strong>Now and then:</strong> your first tap and first solve ever, your streak length,
            whether you solved the how-to-play lesson, and when you share a result.
          </li>
        </ul>
        <p>
          We don’t store your IP address, an identifier or a time, only totals, most of them by
          day. Nothing links one total to another or to you. The totals are public, so a country
          or a quiet day with very few players will show a small number.
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

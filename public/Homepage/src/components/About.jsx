import React from 'react';

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about__head">
        <span className="eyebrow">About</span>
        <h2>Small puzzles, played by ear.</h2>
      </div>

      <div className="about__cols">
        <div className="about__col">
          <p>
            Overtone is a handful of daily games about hearing. Each one takes a minute or
            two, arrives once a day, and is the same for everyone who plays it.
          </p>
          <p>
            There is no account, no app to install, and nothing to subscribe to. Your streak
            lives in your own browser, which means clearing your data loses it — a trade we
            made deliberately. The only data we collect is anonymous totals, such as how many
            people visited, played and solved each puzzle, and which countries they’re in.
            Nothing in them identifies you.
          </p>
        </div>

        <div className="about__col">
          <p>
            Every melody is in the public domain. Nothing here is a recording: the notes are
            synthesised in your browser the moment you tap, which is why it works offline and
            loads in under a second on a bad connection.
          </p>
          <p>
            Built by one person, slowly. If something sounds wrong or breaks on your phone,{' '}
            <a href="mailto:contact@overtone.games">write in</a> — it genuinely helps.
          </p>
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Puzzle rollover</dt>
          <dd>Midnight UTC, so everyone plays the same one at once</dd>
        </div>
        <div>
          <dt>Accounts</dt>
          <dd>None, ever</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>Free</dd>
        </div>
      </dl>
    </section>
  );
}

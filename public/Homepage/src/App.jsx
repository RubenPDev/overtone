import React, { useEffect } from 'react';
import Header from './components/Header.jsx';
import GameCard from './components/GameCard.jsx';
import About from './components/About.jsx';
import Archive from './components/Archive.jsx';
import Footer from './components/Footer.jsx';
import Privacy from './components/Privacy.jsx';
import CadenceGame from './games/cadence/CadenceGame.jsx';
import { reportVisit } from './lib/stats.js';
import { useTheme } from './lib/useTheme.js';
import { useRoute, parseRoute } from './router.js';
import { GAMES } from './data/games.js';

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function Home({ navigate }) {
  const [featured, ...rest] = GAMES;

  return (
    <>
      <section className="hero">
        <p className="hero__date">{formatToday()}</p>
        <h1 className="hero__title">Daily puzzles<br />for your ears.</h1>
        <p className="hero__lede">
          One minute a day. No account, no app, no price. Just a tune you half-remember
          and the gaps between its notes.
        </p>
      </section>

      <section className="games" id="games">
        <div className="games__head">
          <span className="eyebrow">Today</span>
          <span className="games__rule" aria-hidden="true" />
        </div>

        <GameCard game={featured} featured navigate={navigate} />

        <div className="games__grid">
          {rest.map((g) => <GameCard key={g.id} game={g} navigate={navigate} />)}
        </div>
      </section>

      <About />
    </>
  );
}

export default function App() {
  const { isDark, toggle } = useTheme();
  const { path, navigate } = useRoute();
  const route = parseRoute(path);

  // Arriving at /#about from another page: the section didn't exist yet when
  // the browser looked for it, so scroll once it has rendered.
  useEffect(() => {
    const { hash } = window.location;
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    reportVisit();
  }, []);

  if (route.view === 'cadence') {
    return <CadenceGame puzzleNumber={route.puzzle} onNavigate={navigate} />;
  }

  return (
    <div className="shell">
      <Header isDark={isDark} onToggleTheme={toggle} navigate={navigate} />

      <main>
        {route.view === 'privacy' && <Privacy />}
        {route.view === 'archive' && <Archive navigate={navigate} />}
        {route.view === 'home' && <Home navigate={navigate} />}
      </main>

      <Footer navigate={navigate} />
    </div>
  );
}

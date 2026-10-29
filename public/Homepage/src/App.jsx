import React from 'react';
import Header from './components/Header.jsx';
import GameCard from './components/GameCard.jsx';
import About from './components/About.jsx';
import Footer from './components/Footer.jsx';
import CadenceGame from './games/cadence/CadenceGame.jsx';
import { useTheme } from './lib/useTheme.js';
import { useRoute, parseRoute } from './router.js';
import { GAMES } from './data/games.js';

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function Home({ navigate, isDark, onToggleTheme }) {
  const [featured, ...rest] = GAMES;

  return (
    <div className="shell">
      <Header isDark={isDark} onToggleTheme={onToggleTheme} navigate={navigate} />

      <main>
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
      </main>

      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  const { isDark, toggle } = useTheme();
  const { path, navigate } = useRoute();
  const route = parseRoute(path);

  if (route.view === 'cadence') {
    return <CadenceGame puzzleNumber={route.puzzle} onNavigate={navigate} />;
  }

  return <Home navigate={navigate} isDark={isDark} onToggleTheme={toggle} />;
}

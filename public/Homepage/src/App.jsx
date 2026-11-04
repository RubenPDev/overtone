import React, { useEffect } from 'react';
import Header from './components/Header.jsx';
import GameCard from './components/GameCard.jsx';
import About from './components/About.jsx';
import CandyBoard from './components/CandyBoard.jsx';
import Archive from './components/Archive.jsx';
import Footer from './components/Footer.jsx';
import LikeCount from './components/LikeCount.jsx';
import Privacy from './components/Privacy.jsx';
import CadenceGame from './games/cadence/CadenceGame.jsx';
import FacetGame from './games/facet/FacetGame.jsx';
import JunctionsGame from './games/junctions/JunctionsGame.jsx';
import { resetForNewRules } from './lib/progress.js';
import { reportVisit } from './lib/stats.js';
import { useTheme } from './lib/useTheme.js';
import { locale, t, useLang } from './lib/i18n.js';
import { useRoute, parseRoute } from './router.js';
import { GAMES } from './data/games.js';

// Outer rows became part of the goal, which replaced every Facet board.
resetForNewRules('facet', 'full-colour');
// Junctions moved to a smaller town, so every day's city is new.
resetForNewRules('junctions', 'small-town');

function formatToday() {
  return new Date().toLocaleDateString(locale(), {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function Home({ navigate }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="hero__date">{formatToday()}</p>
          <h1 className="hero__title">{t('Daily puzzles')}<br />{t('for your ears.')}</h1>
          <p className="hero__lede">
            {t('One minute a day. No account, no app, no price. Just a tune you half-remember, a scrambled block of colour and the shortest way back, or a town’s rush hour to untangle.')}
          </p>
        </div>
        <CandyBoard />
      </section>

      <section className="games" id="games">
        <div className="games__head">
          <span className="eyebrow">{t('Today')}</span>
          <span className="games__rule" aria-hidden="true" />
          <LikeCount />
        </div>

        <div className="games__grid games__grid--live">
          {GAMES.map((g) => <GameCard key={g.id} game={g} featured navigate={navigate} />)}
        </div>
      </section>

      <About />
    </>
  );
}

export default function App() {
  const { isDark, toggle } = useTheme();
  // Everything below re-renders in the new language when it changes.
  useLang();
  const { path, navigate } = useRoute();
  const route = parseRoute(path);

  // Arriving at /#about from another page: the section didn't exist yet when
  // the browser looked for it, so scroll once it has rendered.
  useEffect(() => {
    const { hash } = window.location;
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, []);

  // Each page shown, including moving between puzzles.
  useEffect(() => {
    reportVisit(route.view, route.puzzle ?? null);
  }, [route.view, route.puzzle]);

  if (route.view === 'cadence') {
    return <CadenceGame puzzleNumber={route.puzzle} onNavigate={navigate} isDark={isDark} onToggleTheme={toggle} />;
  }
  if (route.view === 'facet') {
    return <FacetGame puzzleNumber={route.puzzle} onNavigate={navigate} isDark={isDark} onToggleTheme={toggle} />;
  }
  if (route.view === 'junctions') {
    return <JunctionsGame puzzleNumber={route.puzzle} onNavigate={navigate} isDark={isDark} onToggleTheme={toggle} />;
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

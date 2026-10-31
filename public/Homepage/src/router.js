import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// The site may be served from a subpath (e.g. GitHub Pages at /overtone/).
// Routes inside the app are written as '/', '/cadence' etc.; these two
// helpers translate between those and the real URL.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/** '/cadence' -> '/overtone/cadence' */
export function withBase(to) {
  return BASE + to;
}

function currentRoute() {
  const p = window.location.pathname;
  return (p.startsWith(BASE) ? p.slice(BASE.length) : p) || '/';
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A ~40 line router. We don't use react-router because the whole site is
 * a handful of routes, and because the View Transitions handoff below needs the
 * DOM swap to happen synchronously inside startViewTransition — which is
 * fiddlier to arrange through a library than to just do here.
 */
export function useRoute() {
  const [path, setPath] = useState(currentRoute);

  useEffect(() => {
    const onPop = () => setPath(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === currentRoute()) return;

    const commit = () => {
      if (replace) window.history.replaceState({}, '', withBase(to));
      else window.history.pushState({}, '', withBase(to));
      // flushSync so the new DOM exists before startViewTransition snapshots it.
      flushSync(() => setPath(to));
      window.scrollTo(0, 0);
    };

    if (document.startViewTransition && !reducedMotion()) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  return { path, navigate };
}

/** Turns a pathname into something the app can switch on. */
export function parseRoute(path) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (clean === '/') return { view: 'home' };
  if (clean === '/privacy') return { view: 'privacy' };
  if (clean === '/archive') return { view: 'archive' };

  const m = clean.match(/^\/cadence(?:\/(\d+))?$/);
  if (m) return { view: 'cadence', puzzle: m[1] ? parseInt(m[1], 10) : null };

  return { view: 'home' };
}

/** Lets an <a> keep working for middle-click and cmd-click. */
export function linkHandler(navigate, to) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
}

import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A ~40 line router. We don't use react-router because the whole site is
 * three routes, and because the View Transitions handoff below needs the
 * DOM swap to happen synchronously inside startViewTransition — which is
 * fiddlier to arrange through a library than to just do here.
 */
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return;

    const commit = () => {
      if (replace) window.history.replaceState({}, '', to);
      else window.history.pushState({}, '', to);
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

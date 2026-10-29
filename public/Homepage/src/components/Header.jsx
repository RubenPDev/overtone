import React from 'react';
import { linkHandler } from '../router.js';

function Sun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.4M12 19.2v2.4M4.2 12H1.8M22.2 12h-2.4M6.5 6.5 4.8 4.8M19.2 19.2l-1.7-1.7M6.5 17.5l-1.7 1.7M19.2 4.8l-1.7 1.7" strokeLinecap="round" />
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header({ isDark, onToggleTheme, navigate }) {
  return (
    <header className="masthead">
      <a className="brand" href="/" onClick={navigate ? linkHandler(navigate, '/') : undefined}>
        <span className="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9.2" strokeWidth="1.1" />
            <circle cx="12" cy="12" r="5.2" strokeWidth="1.1" opacity="0.55" />
            <circle cx="12" cy="12" r="1.7" strokeWidth="1.1" opacity="0.3" />
          </svg>
        </span>
        <span className="brand__word">Overtone</span>
      </a>

      <nav className="masthead__nav">
        <a href="#games">Games</a>
        <a href="#about">About</a>
        <button
          type="button"
          className="themetoggle"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Light theme' : 'Dark theme'}
        >
          {isDark ? <Sun /> : <Moon />}
        </button>
      </nav>
    </header>
  );
}

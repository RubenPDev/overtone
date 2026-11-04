import React, { useEffect, useRef, useState } from 'react';
import { linkHandler, withBase } from '../router.js';
import { LANGS, setLang, t, useLang } from '../lib/i18n.js';

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

export function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9.2" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="5.2" strokeWidth="1.5" opacity="0.6" />
        <circle cx="12" cy="12" r="1.7" strokeWidth="1.5" opacity="0.35" />
      </svg>
    </span>
  );
}

function Gear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Two or more choices side by side, the one in use lit. */
function Choice({ label, options }) {
  return (
    <div className="settings__row">
      <span className="settings__label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.key} type="button" className="seg__btn" aria-pressed={o.on} lang={o.lang} onClick={o.pick}>
            {o.icon}{o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Theme and language behind one button, so the header stays roomy on a phone.
 * It closes on a choice made outside it, on Escape, or on the button again.
 */
export function SettingsMenu({ className = '', isDark, onToggleTheme }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);

  return (
    <div className="settings" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className={className}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('Settings')}
        title={t('Settings')}
        onClick={() => setOpen((v) => !v)}
      >
        <Gear />
      </button>
      {open && (
        <div className="settings__panel">
          <Choice
            label={t('Theme')}
            options={[
              { key: 'light', text: t('Light'), icon: <Sun />, on: !isDark, pick: () => { if (isDark) onToggleTheme(); } },
              { key: 'dark', text: t('Dark'), icon: <Moon />, on: isDark, pick: () => { if (!isDark) onToggleTheme(); } },
            ]}
          />
          <Choice
            label={t('Language')}
            options={LANGS.map((l) => ({
              key: l,
              text: l === 'es' ? 'Español' : 'English',
              lang: l === 'es' ? 'es-MX' : 'en',
              on: l === lang,
              pick: () => setLang(l),
            }))}
          />
        </div>
      )}
    </div>
  );
}

export default function Header({ isDark, onToggleTheme, navigate }) {
  return (
    <header className="masthead">
      <a className="brand" href={withBase('/')} onClick={navigate ? linkHandler(navigate, '/') : undefined}>
        <BrandMark />
        <span className="brand__word">Overtone</span>
      </a>

      <nav className="masthead__nav">
        <a href={withBase('/#games')}>{t('Games')}</a>
        <a href={withBase('/#about')}>{t('About')}</a>
        <SettingsMenu className="themetoggle" isDark={isDark} onToggleTheme={onToggleTheme} />
      </nav>
    </header>
  );
}

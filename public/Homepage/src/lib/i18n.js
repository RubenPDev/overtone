import { useEffect, useState } from 'react';
import { safeGet, safeSet } from './progress.js';
import ES from './es.js';

/* English or Mexican Spanish. The English is written in the code itself and doubles
   as the key into the Spanish dictionary in es.js, so anything not translated yet
   simply shows in English.

   A first visit picks Spanish for a device set to a Mexican time zone (or one that
   asks for es-MX), and English otherwise. Once someone picks with the toggle, that
   choice is kept. */

const KEY = 'overtone:lang';
export const LANGS = ['en', 'es'];

const MEXICO = new Set([
  'America/Mexico_City', 'America/Cancun', 'America/Merida', 'America/Monterrey', 'America/Matamoros',
  'America/Chihuahua', 'America/Ciudad_Juarez', 'America/Ojinaga', 'America/Mazatlan', 'America/Bahia_Banderas',
  'America/Hermosillo', 'America/Tijuana', 'America/Ensenada', 'America/Santa_Isabel', 'Mexico/General',
  'Mexico/BajaNorte', 'Mexico/BajaSur',
]);

function firstGuess() {
  if (typeof window === 'undefined') return 'en';
  try {
    if (MEXICO.has(Intl.DateTimeFormat().resolvedOptions().timeZone)) return 'es';
  } catch { /* no Intl: fall through */ }
  const asked = navigator.languages ?? [navigator.language];
  return asked.some((l) => /^es-MX$/i.test(l)) ? 'es' : 'en';
}

let lang = (() => {
  const saved = typeof window === 'undefined' ? null : safeGet(KEY);
  return LANGS.includes(saved) ? saved : firstGuess();
})();
const listeners = new Set();

function applyToPage() {
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'es' ? 'es-MX' : 'en';
}
applyToPage();

export function getLang() { return lang; }

/** For dates and numbers: the locale that goes with the language. */
export function locale() { return lang === 'es' ? 'es-MX' : 'en-US'; }

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  safeSet(KEY, next);
  applyToPage();
  listeners.forEach((listener) => listener(next));
}

/** The current language, re-rendering whoever uses it when it changes. */
export function useLang() {
  const [value, setValue] = useState(lang);
  useEffect(() => {
    listeners.add(setValue);
    setValue(lang);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

// English that was asked for in Spanish and isn't in the dictionary yet, for checking.
const missing = new Set();
if (typeof window !== 'undefined') window.__i18nMissing = missing;

/**
 * The text in the current language. `{name}` in it is filled from `vars`.
 * Pass the English exactly as written: it's the key.
 */
export function t(text, vars) {
  let out = text;
  if (lang === 'es') {
    out = ES[text];
    if (out === undefined) { missing.add(text); out = text; }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : out;
}

/** Marks English for translation where it's written, to be passed through t() when shown. */
export const tx = (text) => text;

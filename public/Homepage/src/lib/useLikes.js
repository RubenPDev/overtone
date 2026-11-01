import { useEffect, useState } from 'react';
import { STATS_URL } from './stats.js';

/* The site-wide total, shared by everything showing it and fetched once per page
   load. It stays null if it can't be read, so nothing shows instead of a wrong 0. */

let total = null;
let requested = false;
let pending = false; // liked before the total arrived
const listeners = new Set();

function publish(value) {
  total = value;
  listeners.forEach((listener) => listener(value));
}

function load() {
  if (requested || import.meta.env.DEV) return;
  requested = true;
  fetch(`${STATS_URL}/likes`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => { if (Number.isInteger(data?.likes)) publish(data.likes + (pending ? 1 : 0)); })
    .catch(() => {});
}

/** The visitor's own like shows straight away, without waiting to re-read the total. */
export function countOwnLike() {
  if (total === null) pending = true;
  else publish(total + 1);
}

export function useLikes() {
  const [likes, setLikes] = useState(total);
  useEffect(() => {
    listeners.add(setLikes);
    setLikes(total);
    load();
    return () => { listeners.delete(setLikes); };
  }, []);
  return likes;
}

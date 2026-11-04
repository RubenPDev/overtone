import React from 'react';
import { useLikes } from '../lib/useLikes.js';
import { locale, t } from '../lib/i18n.js';

export const HEART_PATH = 'M26 38.5C14.5 30.5 11 25 11 20.2 11 15.8 14.4 13 18 13c3.4 0 6.4 2 8 5 1.6-3 4.6-5 8-5 3.6 0 7 2.8 7 7.2 0 4.8-3.5 10.3-15 18.3z';

export default function LikeCount() {
  const likes = useLikes();
  // Nothing rather than a bare zero, before anyone has liked anything.
  if (!likes) return null;
  return (
    <span className="likes">
      <svg viewBox="8 10 36 32" aria-hidden="true"><path d={HEART_PATH} fill="currentColor" /></svg>
      {likes.toLocaleString(locale())} {likes === 1 ? t('like') : t('likes')}
    </span>
  );
}

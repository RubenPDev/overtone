import React from 'react';

// The name after paypal.me/ on your PayPal.Me link. The link stays hidden until it's set.
const PAYPAL_ME = 'PorcayoEspinoza';
const SUGGESTED = { amount: '1.99', code: 'USD', label: '$1.99' };

/** A plain link, so nothing loads from PayPal unless someone chooses to go there. */
export default function DonateLink({ quiet = false }) {
  if (!PAYPAL_ME) return null;
  return (
    <a
      className={`donate${quiet ? ' donate--quiet' : ''}`}
      href={`https://paypal.me/${PAYPAL_ME}/${SUGGESTED.amount}${SUGGESTED.code}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2.5M12.5 3v2.5" />
      </svg>
      Buy me a coffee · {SUGGESTED.label}
    </a>
  );
}

import React from 'react';
import ArchiveList from '../games/cadence/ArchiveList.jsx';
import { puzzlePath } from '../games/cadence/melodies.js';

export default function Archive({ navigate }) {
  return (
    <section className="page">
      <span className="eyebrow">Archive</span>
      <h1 className="page__title">Every puzzle so far.</h1>
      <p className="page__lede">
        Missed a day, or want another go? Replaying an old puzzle won’t change your streak.
      </p>

      <div className="page__game archive__game">
        <h2>Cadence</h2>
        <ArchiveList onPick={(n) => navigate(puzzlePath(n))} />
      </div>
    </section>
  );
}

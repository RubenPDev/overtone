import React from 'react';
import { t } from '../lib/i18n.js';
import ArchiveList from '../games/cadence/ArchiveList.jsx';
import { puzzlePath } from '../games/cadence/melodies.js';
import FacetArchiveList from '../games/facet/ArchiveList.jsx';
import { puzzlePath as facetPath } from '../games/facet/solver.js';
import JunctionsArchiveList from '../games/junctions/ArchiveList.jsx';
import { puzzlePath as junctionsPath } from '../games/junctions/puzzles.js';

export default function Archive({ navigate }) {
  return (
    <section className="page">
      <span className="eyebrow">{t('Archive')}</span>
      <h1 className="page__title">{t('Every puzzle so far.')}</h1>
      <p className="page__lede">
        {t('Missed a day, or want another go? Replaying an old puzzle won’t change your streak.')}
      </p>

      <div className="page__game archive__game">
        <h2>Cadence</h2>
        <ArchiveList onPick={(n) => navigate(puzzlePath(n))} />
      </div>

      <div className="page__game archive__game">
        <h2>Facet</h2>
        <FacetArchiveList onPick={(n) => navigate(facetPath(n))} />
      </div>

      <div className="page__game archive__game">
        <h2>Junctions</h2>
        <JunctionsArchiveList onPick={(n) => navigate(junctionsPath(n))} />
      </div>
    </section>
  );
}

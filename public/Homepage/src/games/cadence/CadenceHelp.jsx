import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createCadenceEngine } from './engine.js';
import { hueFor, NOTE as N } from './melodies.js';
import { reportLesson } from '../../lib/stats.js';
import { useDialog } from '../../lib/useDialog.js';

/* Deliberately not in the catalogue, so learning the game never spoils a
   puzzle. It has its own engine and never touches progress or stats. */
const LESSON = {
  title: 'Hot Cross Buns',
  composer: 'trad.',
  notes: [N.E4, N.D4, N.C4, N.E4, N.D4, N.C4],
  gaps: [1, 1, 2, 1, 1],
  playback: 0.42,
};
const WORDS = ['Hot', 'cross', 'buns', 'hot', 'cross', 'buns'];

/** Same reading as the rim: a word is graded by how long it was held, and the last can't be wrong. */
function wordColor(k, index, result) {
  if (result) {
    const mark = result.marks[k] ?? 0;
    return mark === 0 ? 'var(--ok)' : mark === -1 ? 'var(--warn)' : 'var(--bad)';
  }
  if (k >= index) return undefined;
  const [r, g, b] = hueFor(LESSON.notes[k]);
  return `rgb(${r},${g},${b})`;
}

export default function CadenceHelp({ visual, onClose, openedByTap }) {
  const padRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const solvedRef = useRef(false);
  const close = useCallback(() => {
    reportLesson(solvedRef.current);
    onClose();
  }, [onClose]);
  const panelRef = useDialog(close);
  const [state, setState] = useState({ index: 0, finished: false, result: null });

  useEffect(() => {
    const engine = createCadenceEngine({
      pad: padRef.current,
      canvas: canvasRef.current,
      onChange: setState,
    });
    engineRef.current = engine;
    engine.setVisual(visual);
    engine.loadMelody(LESSON);
    // Still inside the tap that opened this, so iOS may let audio start now.
    if (openedByTap) engine.unlock();
    return () => { engine.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onHear = () => {
    engineRef.current?.reset();
    engineRef.current?.reveal();
  };

  const { index, finished, result } = state;
  const solved = result && result.correct === result.total;
  if (solved) solvedRef.current = true;

  return (
    <div className="cad-help" onClick={close}>
      <div
        className="cad-help__panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cad-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="cad-help__title" id="cad-help-title">How to play</h2>
        <p className="cad-help__text">
          Every puzzle is a tune you probably know. Each tap plays its next note for you, so
          the notes are never wrong. The only thing you choose is <em>when</em>.
        </p>
        <p className="cad-help__text">
          Try it: tap out “Hot cross buns” twice, with a pause after the first “buns”.
        </p>

        <p className="cad-help__words" aria-hidden="true">
          {WORDS.map((word, k) => (
            <span key={k} style={{ color: wordColor(k, index, result) }}>{word}</span>
          ))}
        </p>

        <div className="cad__padwrap">
          <div className="cad__pad" ref={padRef}>
            <canvas ref={canvasRef} className="cad__scope" />
            <span className={`cad__padlabel${index > 0 && !finished ? ' is-quiet' : ''}`}>
              {finished ? 'tap to try again' : index === 0 ? 'tap here' : 'keep going'}
            </span>
          </div>
        </div>

        <p className="cad-help__result" aria-live="polite">
          {!result && 'Go at any speed. Only the pattern counts.'}
          {solved && <b className="is-ok">That’s it. You’re ready for a real one.</b>}
          {result && !solved && (
            <>
              <b className="is-bad">{result.correct} of {result.total} gaps right.</b>{' '}
              Amber means you held too short, red too long. Tap to go again.
            </>
          )}
        </p>

        <ul className="cad-help__list">
          <li>There’s one new tune a day, with a small clue under the pad.</li>
          <li>Try as many times as you like. A wrong try costs nothing.</li>
          <li>Stuck? After one try you can hear the answer, but solving it after that counts as assisted.</li>
        </ul>

        <div className="cad-help__actions">
          <button type="button" className="cad__btn" onClick={onHear}>Hear it</button>
          <button type="button" className="cad__btn cad__btn--primary" onClick={close}>Got it</button>
        </div>
      </div>
    </div>
  );
}

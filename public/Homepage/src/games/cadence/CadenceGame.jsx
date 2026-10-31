import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCadenceEngine } from './engine.js';
import { hueFor, puzzleForNumber, todayNumber } from './melodies.js';
import {
  helpSeen, hintUsed, isSolved, markHelpSeen, markHintUsed, readResults, readTries, recordPlay, recordTry,
  readVisualPrefs, writeVisualPrefs,
} from '../../lib/progress.js';
import { reportResult } from '../../lib/stats.js';
import ArchiveDrawer from './ArchiveDrawer.jsx';
import CadenceHelp from './CadenceHelp.jsx';
import CadenceResult, { ResultIcon } from './CadenceResult.jsx';
import './cadence.css';

const NS = 'cadence';
const DEFAULT_VISUAL = { lobes: 3, spike: 1.9, uneven: 0.30, steady: 0.18 };
const RESULT_DELAY_MS = 900; // lets the last note ring and the graded strip land

const SLIDERS = [
  { key: 'lobes', label: 'Lobes', min: 1, max: 12, step: 1, fmt: (v) => String(v) },
  { key: 'spike', label: 'Spike', min: 1, max: 3, step: 0.1, fmt: (v) => v.toFixed(1) },
  { key: 'uneven', label: 'Uneven', min: 0, max: 0.6, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'steady', label: 'Steady', min: 0.05, max: 0.6, step: 0.01, fmt: (v) => v.toFixed(2) },
];

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function CadenceGame({ puzzleNumber, onNavigate }) {
  const padRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const today = useMemo(() => todayNumber(), []);
  // A URL can name a puzzle whose day hasn't come yet (or never existed).
  const invalidUrl = puzzleNumber != null && (puzzleNumber < 1 || puzzleNumber > todayNumber());
  const number = puzzleNumber == null || invalidUrl ? today : puzzleNumber;
  const puzzle = useMemo(() => puzzleForNumber(number), [number]);
  const melody = puzzle.melody;
  const isToday = number === today;

  useEffect(() => {
    if (invalidUrl) onNavigate('/cadence', { replace: true });
  }, [invalidUrl, onNavigate]);

  const [state, setState] = useState({
    index: 0, total: melody.notes.length, finished: false,
    lastGapMs: null, fastestMs: null, result: null,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  // false, or how it was opened: 'auto' on a first visit, 'tap' from the button.
  const [showHelp, setShowHelp] = useState(() => (helpSeen(NS) ? false : 'auto'));
  const closeHelp = useCallback(() => setShowHelp(false), []);

  useEffect(() => { if (showHelp) markHelpSeen(NS); }, [showHelp]);
  const [showResult, setShowResult] = useState(() => isSolved(readResults(NS)[number]));
  const closeResult = useCallback(() => setShowResult(false), []);
  const [visual, setVisual] = useState(() => readVisualPrefs(NS, DEFAULT_VISUAL));

  /* Engine owns the canvas and the audio; it is created once for the lifetime
     of this component and told about new melodies, never torn down per puzzle. */
  useEffect(() => {
    const engine = createCadenceEngine({
      pad: padRef.current,
      canvas: canvasRef.current,
      onChange: setState,
    });
    engineRef.current = engine;
    engine.setVisual(visual);
    return () => { engine.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engineRef.current?.loadMelody(melody); }, [melody]);
  useEffect(() => { engineRef.current?.setVisual(visual); }, [visual]);

  /* "Hear answer" is a hint with a price. It unlocks only after one blind
     attempt, asks once before playing, and from then on any solve of this
     puzzle is recorded as assisted rather than solved. Once you've solved it
     cleanly there's nothing left to lose, so it plays straight away. */
  const [heard, setHeard] = useState(() => hintUsed(NS, number));
  const [attempts, setAttempts] = useState(() => readTries(NS, number)?.count ?? 0);
  const [armed, setArmed] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const heardRef = useRef(heard);

  useEffect(() => {
    const h = hintUsed(NS, number);
    setHeard(h);
    heardRef.current = h;
    setAttempts(readTries(NS, number)?.count ?? 0);
    setArmed(false);
    setOutcome(null);
    // Coming back to a solved puzzle shows how it went, not a blank board.
    setShowResult(isSolved(readResults(NS)[number]));
  }, [number]);

  // Switching puzzles re-runs this effect before the engine's reset lands, so
  // the previous puzzle's result would otherwise be recorded against the new one.
  const seenResultRef = useRef(null);

  useEffect(() => {
    if (!state.result) { setOutcome(null); return; }
    if (state.result === seenResultRef.current) return;
    seenResultRef.current = state.result;
    const solved = state.result.correct === state.result.total;
    const kind = !solved ? 'missed' : heardRef.current ? 'assisted' : 'solved';
    const firstSolve = recordTry(NS, number, state.result.marks, solved);
    const count = readTries(NS, number)?.count ?? 0;
    setAttempts(Math.max(count, 1));
    setOutcome({ kind, firstTry: kind === 'solved' && firstSolve && count === 1 });
    recordPlay(NS, { puzzleNumber: number, outcome: kind, isToday });
    reportResult(NS, number, kind);
  }, [state.result, number, isToday]);

  // Tapping to go again during the delay clears the outcome, and with it this timer.
  useEffect(() => {
    if (!isSolved(outcome?.kind)) return undefined;
    const t = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [outcome]);

  const onReplay = useCallback(() => {
    setShowResult(false);
    engineRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const solvedClean = readResults(NS)[number] === 'solved';
  const hintLocked = attempts === 0 && !heard && !solvedClean;

  const onHear = useCallback(() => {
    if (!heard && !solvedClean && !armed) { setArmed(true); return; }
    setArmed(false);
    if (!heard) {
      markHintUsed(NS, number);
      heardRef.current = true;
      setHeard(true);
    }
    engineRef.current?.reveal();
  }, [heard, solvedClean, armed, number]);

  const onSlider = useCallback((key, value) => {
    setVisual((prev) => {
      const next = { ...prev, [key]: value };
      writeVisualPrefs(NS, next);
      return next;
    });
  }, []);

  const pickPuzzle = useCallback((n) => {
    setShowArchive(false);
    onNavigate(n === today ? '/cadence' : `/cadence/${n}`);
  }, [onNavigate, today]);

  const hues = useMemo(() => melody.notes.map(hueFor), [melody]);
  const { result } = state;

  const dateLabel = puzzle.date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="cadence">
      <ArchiveDrawer
        open={showArchive}
        onClose={() => setShowArchive(false)}
        current={number}
        onPick={pickPuzzle}
      />
      {showResult && <CadenceResult ns={NS} puzzle={puzzle} onClose={closeResult} onReplay={onReplay} />}
      {showHelp && <CadenceHelp visual={visual} onClose={closeHelp} openedByTap={showHelp === 'tap'} />}

      <div className="cadence__stage">
        <header className="cad__bar">
          <button type="button" className="cad__iconbtn" onClick={() => onNavigate('/')} aria-label="Back to all games">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M13 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Games</span>
          </button>

          <div className="cad__barend">
            {isSolved(readResults(NS)[number]) && (
              <button type="button" className="cad__iconbtn" onClick={() => setShowResult(true)} aria-label="Your result">
                <ResultIcon name="star" />
              </button>
            )}
            <button type="button" className="cad__iconbtn" onClick={() => setShowHelp('tap')} aria-label="How to play">
              <span>?</span>
            </button>
            <button type="button" className="cad__iconbtn" onClick={() => setShowArchive(true)} aria-label="Open archive">
              <span>#{number}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="cad__masthead">
          <h1 className="cad__title">Cadence</h1>
          <span className="cad__stamp">{dateLabel}</span>
        </div>

        <div className="cad__stripwrap">
          <span>{isToday ? 'Today' : `Puzzle ${number}`}</span>
          <span>{state.index} / {state.total}</span>
        </div>

        <div className="cad__strip">
          {melody.notes.map((freq, k) => {
            const played = k < state.index;
            let style = {};
            // Each cell is graded by how long its note was held: the gap up to the
            // next tap. Nothing follows the last note, so it can't be wrong, and
            // it's drawn at the tune's longest length since that's where it rests.
            if (result) {
              const mark = result.marks[k] ?? 0;
              const held = melody.gaps[k] ?? Math.max(...melody.gaps);
              style = {
                height: `${9 + Math.min(held, 4) * 5}px`,
                background: mark === 0 ? 'var(--ok)' : mark === -1 ? 'var(--warn)' : 'var(--bad)',
              };
            } else if (played) {
              const [r, g, b] = hues[k];
              style = { height: '25px', background: `rgba(${r},${g},${b},0.85)` };
            }
            return <div key={k} className="cad__cell" style={style} />;
          })}
        </div>

        <div className="cad__padwrap">
          <div className="cad__pad" ref={padRef} style={{ viewTransitionName: 'mark-cadence' }}>
            <canvas ref={canvasRef} className="cad__scope" />
            <span className={`cad__padlabel${state.index > 0 && !state.finished ? ' is-quiet' : ''}`}>
              {state.finished ? 'tap to try again' : state.index === 0 ? 'tap anywhere' : 'keep going'}
            </span>
          </div>
        </div>

        <div className="cad__readouts">
          <span>{state.lastGapMs ? `gap ${state.lastGapMs} ms` : 'gap —'}</span>
          <span>{state.fastestMs ? `fastest ${state.fastestMs} ms` : 'fastest —'}</span>
        </div>

        <p className="cad__hint">
          {result ? (
            result.correct === result.total ? (
              <>
                <b className="is-ok">
                  {outcome?.kind === 'assisted' ? 'Solved, with help.'
                    : outcome?.firstTry ? 'Solved, first try.' : 'Solved by ear.'}
                </b>{' '}
                {melody.title} — {melody.composer.replace(/\.$/, '')}. {melody.solved}{' '}
                You played it at about {result.bpm} bpm; the tempo was never graded.
              </>
            ) : (
              <>
                <b className="is-bad">{result.correct} of {result.total} gaps right.</b>{' '}
                Amber means you held too short, red too long.{' '}
                {heard
                  ? 'You’ve heard it now. Go again.'
                  : 'Go again, or hear the answer, though a solve after that counts as assisted.'}
              </>
            )
          ) : melody.intro}
        </p>

        <div className="cad__actions">
          <button type="button" className="cad__btn" onClick={() => engineRef.current?.reset()}>Reset</button>
          <button
            type="button"
            className={`cad__btn${armed ? ' is-armed' : ''}`}
            onClick={onHear}
            disabled={hintLocked}
            title={hintLocked ? 'Have one go first' : undefined}
          >
            {hintLocked ? 'Hear answer'
              : armed ? 'Sure? Counts as assisted'
              : heard || solvedClean ? 'Hear it again' : 'Hear answer'}
          </button>
          <button
            type="button"
            className="cad__btn cad__btn--icon"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            aria-label="Visualizer settings"
          >
            <GearIcon />
          </button>
        </div>

        <div className={`cad__settings${showSettings ? ' is-open' : ''}`}>
          <div className="cad__panel">
            <h2>Visualizer</h2>
            {SLIDERS.map((s) => (
              <div className="cad__row" key={s.key}>
                <label htmlFor={`cad-${s.key}`}>{s.label}</label>
                <input
                  id={`cad-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={visual[s.key]}
                  onChange={(e) => onSlider(s.key, parseFloat(e.target.value))}
                />
                <output>{s.fmt(visual[s.key])}</output>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

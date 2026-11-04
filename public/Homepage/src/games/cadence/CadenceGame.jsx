import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCadenceEngine } from './engine.js';
import { hueFor, lastNumber, puzzleForNumber, todayNumber } from './melodies.js';
import {
  helpSeen, hintUsed, isSolved, markHelpSeen, markHintUsed, readResults, readTries, recordPlay, recordTry,
  readVisualPrefs, writeVisualPrefs,
} from '../../lib/progress.js';
import { reportAbandon, reportFinish, reportHint, reportStart } from '../../lib/stats.js';
import GameBar, { PuzzleStepper, RestartIcon } from '../../components/GameBar.jsx';
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

export default function CadenceGame({ puzzleNumber, onNavigate, isDark, onToggleTheme }) {
  const padRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const today = useMemo(() => todayNumber(), []);
  // A URL can name a puzzle whose day hasn't come yet (or never existed).
  const invalidUrl = puzzleNumber != null && (puzzleNumber < 1 || puzzleNumber > lastNumber());
  const number = puzzleNumber == null || invalidUrl ? today : puzzleNumber;
  const puzzle = useMemo(() => puzzleForNumber(number), [number]);
  const melody = puzzle.melody;
  const isToday = number === today;
  const ahead = number > today; // only reachable in developer mode, and never counted

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

  /* The homepage card's mark morphs into the pad on the way in. During a transition
     a named element is drawn above the whole page, popups and drawer included, so
     the pad keeps its name only for the arrival, never for a move between days. */
  const [morphIn, setMorphIn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setMorphIn(false), 700);
    return () => clearTimeout(t);
  }, []);

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
  const [replaying, setReplaying] = useState(false);
  const heardRef = useRef(heard);

  useEffect(() => {
    const h = hintUsed(NS, number);
    setHeard(h);
    heardRef.current = h;
    setAttempts(readTries(NS, number)?.count ?? 0);
    setArmed(false);
    setOutcome(null);
    setReplaying(false);
    // Coming back to a solved puzzle shows how it went, not a blank board.
    setShowResult(isSolved(readResults(NS)[number]));
  }, [number]);

  // Switching puzzles re-runs this effect before the engine's reset lands, so
  // the previous puzzle's result would otherwise be recorded against the new one.
  const seenResultRef = useRef(null);
  const attemptAt = useRef(0); // when this attempt's first note was tapped

  useEffect(() => {
    if (!state.result) { setOutcome(null); return; }
    if (state.result === seenResultRef.current) return;
    seenResultRef.current = state.result;
    const solved = state.result.correct === state.result.total;
    const kind = !solved ? 'missed' : heardRef.current ? 'assisted' : 'solved';
    const replay = isSolved(readResults(NS)[number]);
    const firstSolve = recordTry(NS, number, state.result.marks, solved);
    const count = readTries(NS, number)?.count ?? 0;
    setAttempts(Math.max(count, 1));
    setOutcome({ kind, firstTry: kind === 'solved' && firstSolve && count === 1 });
    recordPlay(NS, { puzzleNumber: number, outcome: kind, isToday });
    if (!ahead) {
      reportFinish(NS, number, {
        today: isToday, outcome: kind, replay, attempt: replay ? null : count,
        ms: attemptAt.current ? Date.now() - attemptAt.current : null,
        correct: state.result.correct, total: state.result.total, bpm: state.result.bpm, heard: heardRef.current,
      });
    }
  }, [state.result, number, isToday, ahead]);

  // Only when the tap count changes: a switch of puzzle mustn't count as a start.
  useEffect(() => {
    if (state.index > 0) setReplaying(true);
    if (state.index === 1) {
      attemptAt.current = Date.now();
      if (!ahead) reportStart(NS, number, { today: isToday });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  // Trying again during the delay clears the outcome, and with it this timer.
  useEffect(() => {
    if (!isSolved(outcome?.kind)) return undefined;
    const t = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [outcome]);

  const onReplay = useCallback(() => {
    // Starting over part way through a run is giving up on it.
    const live = engineRef.current?.getState();
    if (live && live.index > 0 && !live.finished && !ahead) reportAbandon(NS, number, { at: live.index, of: live.total });
    setShowResult(false);
    setReplaying(true);
    engineRef.current?.reset();
  }, [ahead, number]);

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
    if (!ahead) reportHint(NS, number);
    if (!heard) {
      markHintUsed(NS, number);
      heardRef.current = true;
      setHeard(true);
    }
    engineRef.current?.reveal();
  }, [heard, solvedClean, armed, number, ahead]);

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
  // A puzzle already solved opens solved, until the player starts on it again.
  const pastResult = readResults(NS)[number];
  const returning = !replaying && !result && state.index === 0 && isSolved(pastResult);
  const over = state.finished || returning;
  useEffect(() => { engineRef.current?.setLocked(returning); }, [returning]);

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
        finished={outcome?.kind}
      />
      {showResult && <CadenceResult ns={NS} puzzle={puzzle} onClose={closeResult} onReplay={onReplay} />}
      {showHelp && <CadenceHelp visual={visual} onClose={closeHelp} openedByTap={showHelp === 'tap'} />}

      <div className="cadence__stage">
        <GameBar onNavigate={onNavigate} isDark={isDark} onToggleTheme={onToggleTheme}>
          {isSolved(readResults(NS)[number]) && (
            <button type="button" className="pillbar__btn" onClick={() => setShowResult(true)} aria-label="Your result">
              <ResultIcon name="star" />
            </button>
          )}
          <button type="button" className="pillbar__btn" onClick={() => setShowHelp('tap')} aria-label="How to play">?</button>
        </GameBar>

        <div className="gamehead">
          <PuzzleStepper number={number} last={lastNumber()} onPick={pickPuzzle} onOpenArchive={() => setShowArchive(true)} />
          <h1 className="gamehead__title">Cadence</h1>
          <span className="gamehead__stamp">{dateLabel}</span>
        </div>

        <div className="cad__stripwrap">
          <span>{isToday ? 'Today' : `Puzzle ${number}`}</span>
          <span>{returning ? melody.notes.length : state.index} / {melody.notes.length}</span>
        </div>

        <div className="cad__strip">
          {melody.notes.map((freq, k) => {
            const played = k < state.index;
            let style = {};
            // Each cell is graded by how long its note was held: the gap up to the
            // next tap. Nothing follows the last note, so it can't be wrong, and
            // it's drawn at the tune's longest length since that's where it rests.
            if (result || returning) {
              const mark = result?.marks[k] ?? 0;
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
          <div
            className={`cad__pad${over ? ' is-done' : ''}`}
            ref={padRef}
            style={{ viewTransitionName: morphIn && !showResult && !showHelp ? 'mark-cadence' : 'none' }}
          >
            <canvas ref={canvasRef} className="cad__scope" />
            <span className={`cad__padlabel${state.index > 0 && !state.finished ? ' is-quiet' : ''}`}>
              {over ? (returning || result?.correct === result?.total ? 'solved' : 'all played')
                : state.index === 0 ? 'tap anywhere' : 'keep going'}
            </span>
          </div>
        </div>

        <div className="cad__readouts">
          <span>{state.lastGapMs ? `gap ${state.lastGapMs} ms` : 'gap —'}</span>
          <span>{state.fastestMs ? `fastest ${state.fastestMs} ms` : 'fastest —'}</span>
        </div>

        <p className="cad__hint">
          {returning ? (
            <>
              <b className="is-ok">{pastResult === 'assisted' ? 'Solved, with help.' : 'Solved by ear.'}</b>{' '}
              {melody.title} — {melody.composer.replace(/\.$/, '')}. {melody.solved}
            </>
          ) : result ? (
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
          {over && (
            <button type="button" className="cad__btn cad__btn--primary" onClick={onReplay}>
              <RestartIcon /> Try again
            </button>
          )}
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
          {!over && (
            <button type="button" className="cad__btn cad__btn--round" onClick={onReplay} aria-label="Reset" title="Reset">
              <RestartIcon />
            </button>
          )}
          <button
            type="button"
            className="cad__btn cad__btn--round"
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

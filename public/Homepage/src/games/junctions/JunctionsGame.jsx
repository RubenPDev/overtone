import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COST, TYPES, dateForNumber, dayFrom, lastNumber, puzzlePath, todayNumber, tune } from './puzzles.js';
import { CLEAR_SHARE, DRAIN, RUSH, costOf, createRun, scoreRun, stuckCars } from './sim.js';
import { createRenderer } from './render.js';
import DAYS from './days.json';
import { sound } from '../facet/sound.js';
import {
  helpSeen, isSolved, markHelpSeen, readResults, readTries, recordPlay, recordTry, safeGet, safeSet,
} from '../../lib/progress.js';
import { reportResult, reportStart } from '../../lib/stats.js';
import GameBar, { PuzzleStepper, RestartIcon } from '../../components/GameBar.jsx';
import ArchiveDrawer from '../cadence/ArchiveDrawer.jsx';
import { ResultIcon } from '../cadence/CadenceResult.jsx';
import ArchiveList from './ArchiveList.jsx';
import JunctionsResult from './JunctionsResult.jsx';
import '../facet/facet.css';
import './junctions.css';

const NS = 'junctions';
const SPEEDS = [4, 12]; // sim seconds per real second: watching, and hurrying it along
const RESULT_DELAY_MS = 900;

const TYPE_LABEL = { giveway: 'Give way', lights: 'Lights', roundabout: 'Roundabout', flyover: 'Flyover' };

/* Small pictures of each kind of junction, for the tools and the result. */
function TypeIcon({ type }) {
  return (
    <svg className="jn-icon" viewBox="0 0 24 24" aria-hidden="true">
      {type === 'giveway' && <path d="M4 6h16l-8 13z" />}
      {type === 'lights' && (
        <>
          <rect x="8" y="2.5" width="8" height="19" rx="4" />
          <circle cx="12" cy="7" r="1.6" className="jn-icon__fill" />
          <circle cx="12" cy="12" r="1.6" className="jn-icon__fill" />
          <circle cx="12" cy="17" r="1.6" className="jn-icon__fill" />
        </>
      )}
      {type === 'roundabout' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.6" className="jn-icon__fill" />
          <path d="M17.6 6.4l1.7-1.7M18.2 4.4l1.1 0.3 0.3 1.1" />
        </>
      )}
      {type === 'flyover' && (
        <>
          <path d="M2 15h20" />
          <path d="M3 9c4-3.5 14-3.5 18 0" />
          <path d="M7 7.2v7.8M17 7.2v7.8" />
        </>
      )}
    </svg>
  );
}

/* The tuning of a day, from the file worked out ahead of time if it's there. */
function tuningFor(n) {
  return DAYS.find((d) => d.n === n) ?? tune(n);
}

function readLayouts() {
  try { return JSON.parse(safeGet(`${NS}:layouts`) || '{}'); } catch { return {}; }
}
function saveLayout(n, config) {
  safeSet(`${NS}:layouts`, JSON.stringify({ ...readLayouts(), [n]: config }));
}

/** The time on the rush-hour clock: seven till half past nine. */
function clockAt(t) {
  const minutes = 7 * 60 + Math.round((Math.min(t, RUSH + DRAIN) / (RUSH + DRAIN)) * 150);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

const TUTORIAL = [
  {
    text: 'Rush hour is on its way. Cars come in off the highway and the side streets, and every one of them wants through town. Today, every junction is a plain give-way.',
    highlight: null,
  },
  {
    text: 'Pick a tool, then tap a junction to build it: lights, a roundabout or a flyover. Each costs some of today’s budget. Tap it again to take it back out.',
    highlight: 'tools',
  },
  {
    text: 'Press Run to play the rush. Get 90% of the traffic through to clear the day. Keep every street out of the red as well, and it’s a perfect flow.',
    highlight: 'run',
  },
];

export default function JunctionsGame({ puzzleNumber, onNavigate, isDark, onToggleTheme }) {
  const today = useMemo(() => todayNumber(), []);
  const invalidUrl = puzzleNumber != null && (puzzleNumber < 1 || puzzleNumber > lastNumber());
  const number = puzzleNumber == null || invalidUrl ? today : puzzleNumber;
  const isToday = number === today;
  const ahead = number > today; // only reachable in developer mode, and never counted

  useEffect(() => {
    if (invalidUrl) onNavigate('/junctions', { replace: true });
  }, [invalidUrl, onNavigate]);

  // A day not in the file takes a few seconds to work out, so paint first.
  const [day, setDay] = useState(null);
  useEffect(() => {
    setDay(null);
    const id = setTimeout(() => {
      const tuning = tuningFor(number);
      setDay(tuning ? dayFrom(tuning) : false); // false: no puzzle could be made for this day
    }, 30);
    return () => clearTimeout(id);
  }, [number]);

  const [config, setConfig] = useState({});
  const [tool, setTool] = useState('lights');
  const [run, setRun] = useState(null);       // the run on the board, live or finished
  const [phase, setPhase] = useState('plan'); // plan, running, done
  const [score, setScore] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [hover, setHover] = useState(null);
  const [frame, setFrame] = useState(0);      // ticks while running, to refresh the numbers
  const [tutStep, setTutStep] = useState(() => (helpSeen(NS) ? -1 : 0));
  const [showArchive, setShowArchive] = useState(false);
  const [showResult, setShowResult] = useState(() => isSolved(readResults(NS)[number]));
  const [refusal, setRefusal] = useState(null);
  const closeResult = useCallback(() => setShowResult(false), []);

  // A new day starts from the player's own layout, if they've played it before.
  useEffect(() => {
    setConfig(readLayouts()[number] ?? {});
    setRun(null);
    setPhase('plan');
    setScore(null);
    setShowResult(isSolved(readResults(NS)[number]));
  }, [number]);

  const budget = day?.budget ?? 0;
  const spent = costOf(config);
  const left = budget - spent;

  /* ---------- the board ---------- */

  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [spots, setSpots] = useState([]); // where each junction sits over the canvas
  const drawState = useRef({});
  drawState.current = { run, types: config, hover: phase === 'running' ? null : hover, showPeak: phase === 'done' };

  useLayoutEffect(() => {
    if (!day) return undefined;
    const canvas = canvasRef.current;
    const r = createRenderer(canvas, day);
    rendererRef.current = r;
    const ids = day.city.nodes.filter((n) => n.kind === 'junction').map((n) => n.id);
    const fit = () => {
      r.resize();
      r.draw(drawState.current);
      setSpots(ids.map((id) => ({ id, at: r.at(id), size: r.reach() })));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => { observer.disconnect(); rendererRef.current = null; };
  }, [day]);

  // A frame later, once the page has its new theme, the city re-reads its colours.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const r = rendererRef.current;
      if (!r) return;
      r.setTheme();
      r.draw(drawState.current);
    });
    return () => cancelAnimationFrame(id);
  }, [isDark]);

  useEffect(() => {
    rendererRef.current?.draw(drawState.current);
  }, [config, hover, phase, run, frame]);

  /* ---------- running the rush ---------- */

  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (phase !== 'running' || !run) return undefined;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    let lastTick = 0;
    const tick = (now) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      carry += real * SPEEDS[speedRef.current];
      while (carry >= 0.1 && !run.done) { run.step(); carry -= 0.1; }
      rendererRef.current?.draw(drawState.current);
      if (now - lastTick > 200) { setFrame((f) => f + 1); lastTick = now; }
      if (run.done) { finish(run); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, run]);

  const finish = (done) => {
    const s = scoreRun(done);
    setScore(s);
    setPhase('done');
    setFrame((f) => f + 1);
    const firstSolve = recordTry(NS, number, [Math.round(s.cleared * 100)], s.solved);
    if (s.solved) {
      // Perfect flow is the full solve; cleared with some red is a solve with help.
      const outcome = s.perfect ? 'solved' : 'assisted';
      // Keep the best layout: a later run that only clears doesn't replace a perfect one.
      if (s.perfect || readResults(NS)[number] !== 'solved') saveLayout(number, config);
      recordPlay(NS, { puzzleNumber: number, outcome, isToday });
      if (!ahead) reportResult(NS, number, outcome, { tries: firstSolve ? readTries(NS, number)?.count : null, isToday });
      sound.win();
      setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    }
  };

  const start = () => {
    if (!day) return;
    sound.unlock();
    sound.tick();
    if (!ahead) reportStart(NS, number);
    setRun(createRun(day.city, day.net, day.trips, config));
    setScore(null);
    setPhase('running');
  };

  const stop = () => {
    setRun(null);
    setPhase('plan');
    setScore(null);
  };

  /* ---------- building ---------- */

  const place = useCallback((id) => {
    if (phase === 'running' || id === null) return;
    sound.unlock();
    const current = config[id] ?? 'giveway';
    const next = { ...config };
    if (current === tool || tool === 'giveway') delete next[id];
    else next[id] = tool;
    if (costOf(next) > budget) {
      setRefusal({ id, at: Date.now() });
      return;
    }
    sound.tick();
    setRefusal(null);
    setConfig(next);
    if (phase === 'done') { setRun(null); setPhase('plan'); }
  }, [phase, config, tool, budget]);

  useEffect(() => {
    if (!refusal) return undefined;
    const t = setTimeout(() => setRefusal(null), 1600);
    return () => clearTimeout(t);
  }, [refusal]);

  const clearAll = () => {
    if (phase === 'running') return;
    setConfig({});
    setRun(null);
    setPhase('plan');
    setScore(null);
  };

  const pickPuzzle = useCallback((n) => {
    setShowArchive(false);
    onNavigate(puzzlePath(n));
  }, [onNavigate]);

  const advanceTutorial = useCallback((skip) => {
    sound.tick();
    const next = skip ? TUTORIAL.length : tutStep + 1;
    setTutStep(next);
    if (next >= TUTORIAL.length) markHelpSeen(NS);
  }, [tutStep]);

  const tutorial = tutStep >= 0 && tutStep < TUTORIAL.length ? TUTORIAL[tutStep] : null;
  const highlight = tutorial ? tutorial.highlight : null;

  const dateLabel = dateForNumber(number).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  // The numbers under the title follow the run as it goes.
  const through = run ? run.arrived : 0;
  const total = day ? day.trips.length : 0;
  const stuck = run && phase === 'running' ? stuckCars(run) : 0;
  const clearedPct = score ? Math.round(score.cleared * 100) : null;
  const refusedAt = refusal && rendererRef.current ? rendererRef.current.at(refusal.id) : null;

  return (
    <div className="facet junctions">
      <ArchiveDrawer
        open={showArchive}
        onClose={() => setShowArchive(false)}
        current={number}
        onPick={pickPuzzle}
        finished={phase === 'done' && score?.solved}
        List={ArchiveList}
      />
      {showResult && day && (
        <JunctionsResult
          ns={NS}
          number={number}
          budget={budget}
          config={readLayouts()[number] ?? config}
          onClose={closeResult}
          onReplay={() => { setShowResult(false); stop(); }}
        />
      )}

      <div className="facet__stage-wrap">
        <GameBar onNavigate={onNavigate} isDark={isDark} onToggleTheme={onToggleTheme}>
          {isSolved(readResults(NS)[number]) && (
            <button type="button" className="pillbar__btn" onClick={() => setShowResult(true)} aria-label="Your result">
              <ResultIcon name="star" />
            </button>
          )}
        </GameBar>

        <div className="gamehead">
          <PuzzleStepper number={number} last={lastNumber()} onPick={pickPuzzle} onOpenArchive={() => setShowArchive(true)} />
          <h1 className="gamehead__title">Junctions</h1>
          <span className="gamehead__stamp">{dateLabel}</span>
        </div>

        <div className="fc-score jn-score">
          <div>
            <div className="fc-label">Budget</div>
            <div className="fc-moves">
              ${left} <span>/ ${budget || '—'}</span>
            </div>
          </div>
          <div className="jn-score__run">
            {phase === 'plan' && <span className="fc-label">{total ? `${total} cars due, 7:00 to 9:30` : ''}</span>}
            {phase !== 'plan' && (
              <>
                <span className="jn-clock">{clockAt(run?.t ?? 0)}</span>
                <span className="fc-label">
                  {phase === 'running'
                    ? `${through} through${stuck ? ` · ${stuck} stuck` : ''}`
                    : `${clearedPct}% cleared`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={`jn-tools${highlight === 'tools' ? ' is-pulsing' : ''}`} role="radiogroup" aria-label="Junction to build">
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={tool === type}
              className={`jn-tool jn-tool--${type}${tool === type ? ' is-on' : ''}`}
              onClick={() => { sound.tick(); setTool(type); }}
              disabled={phase === 'running'}
            >
              <TypeIcon type={type} />
              <span className="jn-tool__name">{TYPE_LABEL[type]}</span>
              <span className="jn-tool__cost">{type === 'giveway' ? 'free' : `$${COST[type]}`}</span>
            </button>
          ))}
        </div>

        <div className="fc-stage jn-stage">
          <canvas ref={canvasRef} className="jn-canvas" aria-hidden="true" />
          {/* Each junction is a button over the drawing, for taps and for keyboards alike. */}
          {spots.map(({ id, at, size }) => (
            <button
              key={id}
              type="button"
              className="jn-spot"
              style={{ left: `${at[0]}px`, top: `${at[1]}px`, width: `${size}px`, height: `${size}px` }}
              aria-label={`Junction ${id}: ${TYPE_LABEL[config[id] ?? 'giveway']}`}
              disabled={phase === 'running'}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(id); }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(id)}
              onBlur={() => setHover(null)}
              onClick={() => place(id)}
            />
          ))}
          {day === null && <p className="jn-loading">Planning the day’s traffic…</p>}
          {day === false && <p className="jn-loading">This day’s traffic isn’t ready yet. Try another day from the archive.</p>}
          {refusedAt && (
            <span className="jn-refusal" style={{ left: `${refusedAt[0]}px`, top: `${refusedAt[1]}px` }}>
              Not enough budget
            </span>
          )}
        </div>

        {tutorial ? (
          <div className="fc-card">
            <p>{tutorial.text}</p>
            <div className="fc-cardfoot">
              <button type="button" className="cad__btn cad__btn--primary" onClick={() => advanceTutorial(false)}>
                {tutStep === TUTORIAL.length - 1 ? 'Start' : 'Next'}
              </button>
              <button type="button" className="cad__btn" onClick={() => advanceTutorial(true)}>Skip</button>
              <span className="fc-label">{tutStep + 1} / {TUTORIAL.length}</span>
            </div>
          </div>
        ) : (
          <p className="fc-msg">
            {phase === 'running' && 'Rush hour. Green is flowing, red is jammed.'}
            {phase === 'plan' && (score === null
              ? <>Clear {Math.round(CLEAR_SHARE * 100)}% of the traffic to finish. Keep every street out of the red for a perfect flow.</>
              : null)}
            {phase === 'done' && score && (score.perfect ? (
              <><b className="is-ok">Perfect flow.</b> Nothing ever jammed.</>
            ) : score.solved ? (
              <><b className="is-ok">Cleared, {clearedPct}%.</b> The streets still red are where it jammed. Fix those for a perfect flow.</>
            ) : (
              <><b>Only {clearedPct}% got through.</b> {Math.round(CLEAR_SHARE * 100)}% is needed. The red streets show where it jammed.</>
            ))}
          </p>
        )}

        <div className={`fc-actions${highlight === 'run' ? ' is-pulsing' : ''}`}>
          {phase === 'running' ? (
            <>
              <button type="button" className="cad__btn cad__btn--primary" onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}>
                {speed === 0 ? 'Fast forward' : 'Normal speed'}
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={stop} aria-label="Stop" title="Stop">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /></svg>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cad__btn cad__btn--primary" onClick={start} disabled={!day}>
                {phase === 'done' ? 'Run again' : 'Run rush hour'}
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={clearAll} aria-label="Clear all junctions" title="Clear all junctions">
                <RestartIcon />
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={() => setTutStep(0)} aria-label="How to play" title="How to play">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.2 9a3 3 0 1 1 4 2.8c-.8.4-1.2 1-1.2 1.9v.5" />
                  <circle cx="12" cy="17.6" r=".6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

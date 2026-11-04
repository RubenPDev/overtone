import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COST, TYPES, dateForNumber, dayFrom, lastNumber, puzzlePath, todayNumber, tune } from './puzzles.js';
import { DRAIN, RED, RUSH, costOf, createRun, scoreRun } from './sim.js';
import { createRenderer } from './render.js';
import DAYS from './days.json';
import { sound } from './sound.js';
import {
  helpSeen, isSolved, markHelpSeen, readResults, readTries, recordPlay, recordTry, safeGet, safeSet,
} from '../../lib/progress.js';
import { reportFinish, reportLesson, reportStart } from '../../lib/stats.js';
import { locale, t, tx, useLang } from '../../lib/i18n.js';
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
const JAM_MARKS = 2;    // how many of the worst junctions a run points out

const TYPE_LABEL = { giveway: tx('Give way'), lights: tx('Lights'), roundabout: tx('Roundabout'), flyover: tx('Flyover') };

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

function SoundIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="jn-soundicon">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      {on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
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
/** A layout as short text, for the stats: "5:flyover 7:roundabout". */
function layoutKey(config) {
  return Object.entries(config).filter(([, type]) => type !== 'giveway')
    .sort(([a], [b]) => a - b).map(([id, type]) => `${id}:${type}`).join(' ');
}

/* What each tool is for, shown under the tools for the one picked. */
const TOOL_HINT = {
  giveway: tx('Cars take turns, one at a time. Fine where it’s quiet.'),
  lights: tx('Each direction takes a turn, with a left-turn arrow first. Best where two busy streams cross straight over.'),
  roundabout: tx('Cars join when there’s a gap. Best where traffic turns every which way, but one heavy stream can block the next entrance.'),
  flyover: tx('The through road’s straight traffic goes over the top. Turns use the slip lanes, and the cross road gives way underneath.'),
};

/** Where the day's cars will go: how many use each lane, and where they turn at each junction. */
function forecastFor(day) {
  const volume = new Map();
  const turns = new Map();
  for (const trip of day.trips) {
    trip.path.forEach((id, i) => {
      volume.set(id, (volume.get(id) ?? 0) + 1);
      const next = trip.path[i + 1];
      if (next === undefined) return;
      const a = day.net.lanes[id];
      const node = day.city.nodes[a.to];
      if (!node || node.kind !== 'junction') return;
      const turn = (day.net.lanes[next].heading - a.heading + 4) % 4;
      const m = turns.get(id) ?? { straight: 0, left: 0, right: 0 };
      m[turn === 0 ? 'straight' : turn === 1 ? 'right' : 'left'] += 1;
      turns.set(id, m);
    });
  }
  return { volume, turns, most: Math.max(1, ...volume.values()) };
}

/** The junctions whose queues got worst in a run, worst first, if they went red. */
function worstJunctions(run, city) {
  const peaks = new Map();
  for (const lane of run.lanes) {
    const node = city.nodes[lane.to];
    if (!node || node.kind !== 'junction') continue;
    peaks.set(node.id, Math.max(peaks.get(node.id) ?? 0, lane.peak));
  }
  return [...peaks.entries()].filter(([, p]) => p >= RED).sort((a, b) => b[1] - a[1]).slice(0, JAM_MARKS).map(([id]) => id);
}

/* Each step of the lesson says what it lights up on the screen. */
const TUTORIAL = [
  {
    text: tx('Rush hour is on its way. Cars come in off the highway at the yellow pennant and leave by it at the chequered flag; the side streets at the edges add a few more.'),
    focus: 'highway',
  },
  {
    text: tx('Every crossing is a junction, and today they’re all give-ways. The blue bands are the traffic to come, wider where it’s busier, and the arrows show where cars at each junction want to go.'),
    focus: 'junctions',
  },
  {
    text: tx('Each tool suits a different kind of junction: the line under the tools says what the one you’ve picked is for. Each costs part of today’s budget, and only a few ways of spending it work perfectly.'),
    focus: 'tools',
  },
  {
    text: tx('Then tap a junction to build it there. Tap it again to take it back out.'),
    focus: 'build',
  },
  {
    text: tx('Press Run to play the rush hour. Green streets are flowing, red ones are jammed. Get every car through to clear the day, and keep every street out of the red for a perfect flow.'),
    focus: 'run',
  },
];

export default function JunctionsGame({ puzzleNumber, onNavigate, isDark, onToggleTheme }) {
  const lang = useLang();
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
  const [jams, setJams] = useState([]);       // where the last run jammed worst
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const closeResult = useCallback(() => setShowResult(false), []);
  const planSince = useRef(Date.now()); // when the player started thinking about this run

  // A new day starts from the player's own layout, if they've played it before,
  // keeping only junctions that this day's town really has.
  useEffect(() => {
    if (!day) return;
    const saved = readLayouts()[number] ?? {};
    const real = new Set(day.city.nodes.filter((n) => n.kind === 'junction').map((n) => String(n.id)));
    setConfig(Object.fromEntries(Object.entries(saved).filter(([id]) => real.has(id))));
    setRun(null);
    setPhase('plan');
    setScore(null);
    setJams([]);
    setShowResult(isSolved(readResults(NS)[number]));
    planSince.current = Date.now();
  }, [number, day]);

  const forecast = useMemo(() => (day ? forecastFor(day) : null), [day]);
  const budget = day?.budget ?? 0;
  const spent = costOf(config);
  const left = budget - spent;

  /* ---------- the board ---------- */

  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const [spots, setSpots] = useState([]); // where each junction sits over the canvas
  const [tags, setTags] = useState([]);   // and the highway's tags
  const drawState = useRef({});
  drawState.current = {
    run, types: config, hover: phase === 'running' ? null : hover, showPeak: phase === 'done',
    forecast: phase === 'plan' && !run ? forecast : null,
  };

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
      setTags(r.tags());
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

  // The tags are words on the canvas, so a new language redraws them and moves their outlines.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.draw(drawState.current);
    setTags(r.tags());
  }, [lang]);

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
    let arrived = run.arrived;
    const tick = (now) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      carry += real * SPEEDS[speedRef.current];
      while (carry >= 0.1 && !run.done) { run.step(); carry -= 0.1; }
      const fast = speedRef.current > 0;
      if (run.arrived > arrived) { sound.pop(fast); arrived = run.arrived; }
      sound.traffic(run.cars / 40, fast);
      sound.honk(run.lanes.some((l) => l.heat >= RED));
      rendererRef.current?.draw(drawState.current);
      if (now - lastTick > 200) { setFrame((f) => f + 1); lastTick = now; }
      if (run.done) { finish(run); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); sound.quiet(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, run]);

  // Leaving the page stops the traffic sounding.
  useEffect(() => () => sound.quiet(), []);

  const finish = (done) => {
    const s = scoreRun(done);
    setScore(s);
    setPhase('done');
    setFrame((f) => f + 1);
    setJams(worstJunctions(done, day.city));
    sound.quiet();
    const replay = isSolved(readResults(NS)[number]);
    const flow = Math.round(s.flow * 100);
    recordTry(NS, number, [Math.round(s.cleared * 100), Math.round(s.peak * 100), flow], s.solved);
    // Perfect flow is the full solve; every car through with some red is a solve with help.
    const outcome = !s.solved ? 'missed' : s.perfect ? 'solved' : 'assisted';
    if (!ahead) {
      reportFinish(NS, number, {
        today: isToday, outcome, replay,
        attempt: replay ? null : readTries(NS, number)?.count ?? null,
        cleared: Math.round(s.cleared * 100), stuck: s.stuck, peak: Math.round(s.peak * 100), flow,
        cost: costOf(config), budget, layout: layoutKey(config),
      });
    }
    if (s.solved) {
      // Keep the best layout: a later run with some red doesn't replace a perfect one.
      if (s.perfect || readResults(NS)[number] !== 'solved') saveLayout(number, config);
      recordPlay(NS, { puzzleNumber: number, outcome, isToday });
      sound.win(s.perfect);
      setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    }
  };

  const start = () => {
    if (!day) return;
    sound.unlock();
    sound.tick();
    if (!ahead) {
      reportStart(NS, number, { today: isToday, data: { planMs: Date.now() - planSince.current, cost: costOf(config), layout: layoutKey(config) } });
    }
    setRun(createRun(day.city, day.net, day.trips, config));
    setScore(null);
    setJams([]);
    setPhase('running');
  };

  const stop = () => {
    planSince.current = Date.now();
    sound.quiet();
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
    const removing = current === tool || tool === 'giveway';
    if (removing) delete next[id];
    else next[id] = tool;
    if (costOf(next) > budget) {
      sound.refuse();
      setRefusal({ id, at: Date.now() });
      return;
    }
    sound.place(removing);
    setRefusal(null);
    setConfig(next);
    if (phase === 'done') { setRun(null); setPhase('plan'); planSince.current = Date.now(); }
  }, [phase, config, tool, budget]);

  useEffect(() => {
    if (!refusal) return undefined;
    const id = setTimeout(() => setRefusal(null), 1600);
    return () => clearTimeout(id);
  }, [refusal]);

  const clearAll = () => {
    if (phase === 'running') return;
    setConfig({});
    setRun(null);
    setPhase('plan');
    setScore(null);
  };

  const toggleSound = () => {
    sound.unlock();
    sound.setEnabled(!sound.enabled);
    setSoundOn(sound.enabled);
  };

  const pickPuzzle = useCallback((n) => {
    setShowArchive(false);
    onNavigate(puzzlePath(n));
  }, [onNavigate]);

  const advanceTutorial = useCallback((skip) => {
    if (skip) reportLesson(NS, 'skipped', tutStep + 1);
    else if (tutStep + 1 >= TUTORIAL.length) reportLesson(NS, 'finished');
    sound.tick();
    const next = skip ? TUTORIAL.length : tutStep + 1;
    setTutStep(next);
    if (next >= TUTORIAL.length) markHelpSeen(NS);
  }, [tutStep]);

  const tutorial = tutStep >= 0 && tutStep < TUTORIAL.length ? TUTORIAL[tutStep] : null;
  const focus = tutorial ? tutorial.focus : null;
  const lit = (what) => (focus === what ? ' is-lit' : '');

  const dateLabel = dateForNumber(number).toLocaleDateString(locale(), {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const progress = run ? Math.min(1, run.t / (RUSH + DRAIN)) : 0;
  const refusedAt = refusal && rendererRef.current ? rendererRef.current.at(refusal.id) : null;
  const spotLit = focus === 'junctions' || focus === 'build';
  // Hovering a junction while planning says what its traffic does.
  const hoverInfo = useMemo(() => {
    if (hover === null || phase !== 'plan' || !forecast || !day) return null;
    const m = { straight: 0, left: 0, right: 0 };
    for (const lane of day.net.lanes) {
      if (lane.to !== hover) continue;
      const t = forecast.turns.get(lane.id);
      if (t) { m.straight += t.straight; m.left += t.left; m.right += t.right; }
    }
    const total = m.straight + m.left + m.right;
    if (!total) return null;
    const pct = (n) => Math.round((100 * n) / total);
    return t('{n} cars · {s}% straight, {l}% left, {r}% right', { n: total, s: pct(m.straight), l: pct(m.left), r: pct(m.right) });
  }, [hover, phase, forecast, day, lang]);
  const hoverSpot = hoverInfo ? spots.find((s) => s.id === hover) : null;
  const showJams = !tutorial && phase !== 'running' && jams.length > 0;
  // A bubble that would run off the board slides back on, its point staying on what it means.
  const stageRef = useRef(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    for (const el of stage.querySelectorAll('.jn-callout')) {
      el.style.setProperty('--dx', '0px');
      const r = el.getBoundingClientRect();
      const dx = Math.max(0, box.left + 6 - r.left) - Math.max(0, r.right - (box.right - 6));
      el.style.setProperty('--dx', `${dx}px`);
    }
  });

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
            <button type="button" className="pillbar__btn" onClick={() => setShowResult(true)} aria-label={t('Your result')}>
              <ResultIcon name="star" />
            </button>
          )}
          <button type="button" className="pillbar__btn" onClick={toggleSound} aria-pressed={soundOn}
                  aria-label={soundOn ? t('Turn sound off') : t('Turn sound on')} title={soundOn ? t('Sound on') : t('Sound off')}>
            <SoundIcon on={soundOn} />
          </button>
        </GameBar>

        <div className="gamehead">
          <PuzzleStepper number={number} last={lastNumber()} onPick={pickPuzzle} onOpenArchive={() => setShowArchive(true)} />
          <h1 className="gamehead__title">Junctions</h1>
          <span className="gamehead__stamp">{dateLabel}</span>
        </div>

        <div className="fc-score jn-score">
          <div className={`jn-budget${lit('tools')}`}>
            <div className="fc-label">{t('Budget')}</div>
            <div className="fc-moves">
              ${left} <span>/ ${budget || '—'}</span>
            </div>
          </div>
          <div className="jn-score__run" aria-live="polite">
            {phase === 'running' && (
              <div className="jn-progress" role="progressbar" aria-label={t('Rush hour')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <span className="fc-label">{t('Rush hour')}</span>
                <span className="jn-progress__track"><span style={{ width: `${progress * 100}%` }} /></span>
              </div>
            )}
            {phase === 'done' && score && (
              <span className={`jn-verdict ${score.solved ? 'is-ok' : 'is-bad'}`}>
                {score.solved ? t('Every car through')
                  : score.stuck === 1 ? t('1 car stuck') : t('{n} cars stuck', { n: score.stuck })}
              </span>
            )}
          </div>
        </div>

        <div className="jn-toolbox">
        <div className={`jn-tools${lit('tools')}`} role="radiogroup" aria-label={t('Junction to build')}>
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
              <span className="jn-tool__name">{t(TYPE_LABEL[type])}</span>
              <span className="jn-tool__cost">{type === 'giveway' ? t('free') : `$${COST[type]}`}</span>
            </button>
          ))}
        </div>
        <p className="jn-hint">{t(TOOL_HINT[tool])}</p>
        </div>

        <div className={`fc-stage jn-stage${focus ? ' is-teaching' : ''}`} ref={stageRef}>
          <canvas ref={canvasRef} className="jn-canvas" aria-hidden="true" />
          {/* Each junction is a button over the drawing, for taps and for keyboards alike. */}
          {spots.map(({ id, at, size }, i) => (
            <button
              key={id}
              type="button"
              className={`jn-spot${spotLit ? ' is-lit' : ''}`}
              style={{ left: `${at[0]}px`, top: `${at[1]}px`, width: `${size}px`, height: `${size}px`, '--i': i }}
              aria-label={t('Junction {n}: {type}', { n: id, type: t(TYPE_LABEL[config[id] ?? 'giveway']) })}
              disabled={phase === 'running'}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(id); }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(id)}
              onBlur={() => setHover(null)}
              onClick={() => place(id)}
            />
          ))}

          {/* The lesson's pointers: rings round the highway tags, and a tapping hand. */}
          {focus === 'highway' && tags.map((tag) => (
            <React.Fragment key={tag.kind}>
              <span className="jn-ring jn-ring--tag" style={{ left: `${tag.x}px`, top: `${tag.y}px`, width: `${tag.w + 12}px`, height: `${tag.h + 12}px` }} />
              <span className="jn-callout" style={{ left: `${tag.x}px`, top: `${tag.y - tag.h / 2 - 8}px` }}>
                {tag.kind === 'in' ? t('Cars arrive here') : t('Cars leave here')}
              </span>
            </React.Fragment>
          ))}
          {focus === 'build' && spots[0] && (
            <span className="jn-hand" style={{ left: `${spots[0].at[0]}px`, top: `${spots[0].at[1]}px` }} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a5 5 0 0 1-4.1-2.2L4.6 14a1.5 1.5 0 0 1 2.3-1.9L9 14" /></svg>
            </span>
          )}

          {hoverSpot && (
            <span className="jn-callout jn-callout--info" style={{ left: `${hoverSpot.at[0]}px`, top: `${hoverSpot.at[1] - hoverSpot.size / 2}px` }}>
              {hoverInfo}
            </span>
          )}

          {/* After a run, where it jammed worst. */}
          {showJams && jams.map((id) => {
            const spot = spots.find((s) => s.id === id);
            if (!spot) return null;
            return (
              <span key={id} className="jn-callout jn-callout--jam" style={{ left: `${spot.at[0]}px`, top: `${spot.at[1] - spot.size / 2}px` }}>
                {t('Jammed here')}
              </span>
            );
          })}

          {run && (
            <div className="jn-legend" aria-hidden="true">
              <span>{t('Flowing')}</span>
              <i />
              <span>{t('Jammed')}</span>
            </div>
          )}

          {day === null && <p className="jn-loading">{t('Planning the day’s traffic…')}</p>}
          {day === false && <p className="jn-loading">{t('This day’s traffic isn’t ready yet. Try another day from the archive.')}</p>}
          {refusedAt && (
            <span className="jn-refusal" style={{ left: `${refusedAt[0]}px`, top: `${refusedAt[1]}px` }}>
              {t('Not enough budget')}
            </span>
          )}
        </div>

        {tutorial ? (
          <div className="fc-card jn-card">
            <p>{t(tutorial.text)}</p>
            <div className="fc-cardfoot">
              <button type="button" className="cad__btn cad__btn--primary" onClick={() => advanceTutorial(false)}>
                {tutStep === TUTORIAL.length - 1 ? t('Start') : t('Next')}
              </button>
              <button type="button" className="cad__btn" onClick={() => advanceTutorial(true)}>{t('Skip')}</button>
              <span className="fc-label">{tutStep + 1} / {TUTORIAL.length}</span>
            </div>
          </div>
        ) : (
          <p className="fc-msg">
            {phase === 'running' && t('Rush hour. Green streets are flowing, red ones are jammed.')}
            {phase === 'plan' && !score && t('Upgrade the junctions where traffic will meet, then run the rush hour. Get every car through to clear the day; keep every street out of the red for a perfect flow.')}
            {phase === 'done' && score && (score.perfect ? (
              <><b className="is-ok">{t('Perfect flow.')}</b> {t('Every car got through, and nothing ever jammed.')}</>
            ) : score.solved ? (
              <><b className="is-ok">{t('Every car got through.')}</b> {t('Some streets went red on the way, marked on the board. Fix those for a perfect flow.')}</>
            ) : (
              <><b>{score.stuck === 1 ? t('1 car got stuck.') : t('{n} cars got stuck.', { n: score.stuck })}</b> {t('Every car has to get through. The markers show where it jammed worst.')}</>
            ))}
            {phase === 'done' && score && <> {t('Traffic kept moving {n}% of the time.', { n: Math.round(score.flow * 100) })}</>}
          </p>
        )}

        <div className={`fc-actions${lit('run')}`}>
          {phase === 'running' ? (
            <>
              <button type="button" className="cad__btn cad__btn--primary" onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}>
                {speed === 0 ? t('Fast forward') : t('Normal speed')}
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={stop} aria-label={t('Stop')} title={t('Stop')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /></svg>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="cad__btn cad__btn--primary" onClick={start} disabled={!day}>
                {phase === 'done' ? t('Run again') : t('Run rush hour')}
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={clearAll} aria-label={t('Clear all junctions')} title={t('Clear all junctions')}>
                <RestartIcon />
              </button>
              <button type="button" className="cad__btn cad__btn--round" onClick={() => setTutStep(0)} aria-label={t('How to play')} title={t('How to play')}>
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

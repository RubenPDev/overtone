import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  N, PITCH, CENTRE, RC, SWAPS,
  applyPerm, swapPerm, turnPerm, distances, distanceOf, isBuilt,
  scrambleFor, todayNumber, dateForNumber, puzzlePath,
} from './solver.js';
import { sound } from './sound.js';
import {
  helpSeen, isSolved, markHelpSeen, readResults, readTries, recordBest, recordPlay, recordTry,
} from '../../lib/progress.js';
import { reportResult, reportStart } from '../../lib/stats.js';
import ArchiveDrawer from '../cadence/ArchiveDrawer.jsx';
import { ResultIcon } from '../cadence/CadenceResult.jsx';
import ArchiveList from './ArchiveList.jsx';
import FacetResult from './FacetResult.jsx';
import './facet.css';

const NS = 'facet';
const RESULT_DELAY_MS = 900; // lets the win chime ring and the floor light up

const TARGET = '#16C492';
const JUNK = ['#F65C76', '#5375F2', '#EE971F', '#A361F0'];
const CONTROL = '#737C8F';

/* The floor: 24 flat pips walking the perimeter from the near corner. */
const RING_HALF = 156;
const RING_SIDE = RING_HALF * 2;
const PIP_COUNT = 24;

function pipPositions() {
  const span = (RING_SIDE * 4) / PIP_COUNT;
  const out = [];
  for (let i = 0; i < PIP_COUNT; i++) {
    const u = (i * span + RING_SIDE * 2) % (RING_SIDE * 4);
    let x, y;
    if (u < RING_SIDE) { x = CENTRE - RING_HALF + u; y = CENTRE - RING_HALF; }
    else if (u < RING_SIDE * 2) { x = CENTRE + RING_HALF; y = CENTRE - RING_HALF + (u - RING_SIDE); }
    else if (u < RING_SIDE * 3) { x = CENTRE + RING_HALF - (u - RING_SIDE * 2); y = CENTRE + RING_HALF; }
    else { x = CENTRE - RING_HALF; y = CENTRE + RING_HALF - (u - RING_SIDE * 3); }
    out.push([x - 7.5, y - 7.5]);
  }
  return out;
}
const PIPS = pipPositions();

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function darken(c, k) {
  const p = hex(c);
  return `rgb(${Math.round(p[0] * (1 - k))},${Math.round(p[1] * (1 - k))},${Math.round(p[2] * (1 - k))})`;
}

/* Depth is a stack of hard shadows along local (1,1) — the one direction
   that projects to straight down once the board is tilted. */
function extrusion(colour, steps = 10) {
  const mid = darken(colour, 0.48);
  const low = darken(colour, 0.62);
  const parts = [];
  for (let i = 1; i <= steps; i++) {
    parts.push(`${i}px ${i}px 0 ${i > steps * 0.7 ? low : mid}`);
  }
  parts.push(`${steps + 3}px ${steps + 3}px 11px rgba(0,0,0,.45)`);
  parts.push(`${steps + 9}px ${steps + 9}px 24px rgba(0,0,0,.26)`);
  return parts.join(',');
}

const ARROW_CW =
  'M33 13.9A14 14 0 1 1 19 13.9M25.9 9.9L21.8 18.6L16.3 9.1Z';
const ARROW_CCW =
  'M19 13.9A14 14 0 1 0 33 13.9M26.1 9.9L30.2 18.6L35.7 9.1Z';

function TurnBlock({ dir, col, row, pulsing, onTurn }) {
  const [pressed, setPressed] = useState(false);
  const d = dir > 0 ? ARROW_CW : ARROW_CCW;
  return (
    <div
      className={`fc-block fc-turn${pulsing ? ' is-pulsing' : ''}`}
      style={{
        background: darken(CONTROL, 0.3),
        boxShadow: extrusion(CONTROL, pressed ? 4 : 10),
        transform: `translate3d(${col * PITCH}px,${row * PITCH}px,0)`,
        zIndex: Math.round(col * PITCH + row * PITCH),
      }}
      role="button"
      tabIndex={0}
      aria-label={dir > 0 ? 'Turn ring right' : 'Turn ring left'}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => onTurn(dir)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTurn(dir); } }}
    >
      <div className="fc-face" style={{ background: CONTROL }} />
      {/* The arrow lies in the plane the ring turns in, so the projection
          squashing it into an ellipse is the point, not a flaw. */}
      <svg className="fc-arrow" viewBox="0 0 52 52" aria-hidden="true">
        <path d={d} fill="rgba(255,255,255,.92)" stroke="rgba(255,255,255,.92)"
              strokeWidth="5" strokeLinecap="round" fillRule="evenodd" />
      </svg>
    </div>
  );
}

const TUTORIAL = [
  {
    text: 'Tap any outer block. It trades places with the one face cell it touches. With a mouse, hover first and both light up so you can see the pair.',
    highlight: 'swaps',
  },
  {
    text: 'The grey blocks at the left and right corners turn the ring of eight a quarter turn. The centre never moves — it sets the colour you are aiming for.',
    highlight: 'turns',
  },
  {
    text: 'The floor is your distance to solved, two tiles lit per move still needed. Fill all eight blocks around the centre, in as few moves as you can.',
    highlight: 'floor',
  },
];

export default function FacetGame({ puzzleNumber, onNavigate }) {
  const today = useMemo(() => todayNumber(), []);
  // A URL can name a puzzle whose day hasn't come yet (or never existed).
  const invalidUrl = puzzleNumber != null && (puzzleNumber < 1 || puzzleNumber > todayNumber());
  const number = puzzleNumber == null || invalidUrl ? today : puzzleNumber;
  const isToday = number === today;

  useEffect(() => {
    if (invalidUrl) onNavigate('/facet', { replace: true });
  }, [invalidUrl, onNavigate]);

  /* The search table is a module singleton, but building it blocks for
     ~100ms, so paint the shell first and fill it in on the next tick. */
  const [ready, setReady] = useState(() => isBuilt());
  useEffect(() => {
    if (ready) return undefined;
    const id = setTimeout(() => { distances(); setReady(true); }, 0);
    return () => clearTimeout(id);
  }, [ready]);

  const puzzle = useMemo(() => (ready ? scrambleFor(number) : null), [ready, number]);

  const identity = useMemo(() => Array.from({ length: N }, (_, i) => i), []);
  const [pos, setPos] = useState(identity);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [showFloor, setShowFloor] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [tutStep, setTutStep] = useState(() => (helpSeen(NS) ? -1 : 0));
  const [showArchive, setShowArchive] = useState(false);
  const [showResult, setShowResult] = useState(() => isSolved(readResults(NS)[number]));
  const closeResult = useCallback(() => setShowResult(false), []);
  const busy = useRef(false);

  const colours = puzzle ? puzzle.colours : null;
  const par = puzzle ? puzzle.par : 0;

  useEffect(() => {
    setPos(identity);
    setMoves(0);
    setSolved(false);
    sound.resetPhrase();
  }, [number, identity, puzzle]);

  // Coming back to a solved puzzle shows how it went, not a blank board.
  useEffect(() => {
    setShowResult(isSolved(readResults(NS)[number]));
  }, [number]);

  const distance = colours ? distanceOf(pos, colours) : null;

  useEffect(() => {
    if (distance !== 0 || solved || !colours) return;
    setSolved(true);
    sound.win();
    recordBest(NS, number, moves);
    const firstSolve = recordTry(NS, number, [], true);
    recordPlay(NS, { puzzleNumber: number, solved: true, isToday });
    reportResult(NS, number, 'solved', { tries: firstSolve ? readTries(NS, number)?.count : null, isToday });
  }, [distance, solved, colours, number, isToday, moves]);

  // Restarting during the delay clears `solved`, and with it this timer.
  useEffect(() => {
    if (!solved) return undefined;
    const t = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [solved]);

  // Only when the count changes: a switch of puzzle mustn't count as a start.
  useEffect(() => {
    if (moves === 1) reportStart(NS, number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves]);

  const doSwap = useCallback((arm, ring) => {
    if (solved || busy.current || !colours) return;
    sound.unlock();
    setPos((p) => applyPerm(p, swapPerm(arm, ring)));
    setMoves((m) => m + 1);
    sound.swap();
  }, [solved, colours]);

  const doTurn = useCallback((k) => {
    if (solved || busy.current || !colours) return;
    busy.current = true;
    sound.unlock();
    sound.turn(k);
    setPos((p) => applyPerm(p, turnPerm(k)));
    setMoves((m) => m + Math.abs(k));
    setHovered(null);
    setTimeout(() => { busy.current = false; }, 240);
  }, [solved, colours]);

  /* Arrow keys turn the ring — the board is otherwise mouse-only. */
  useEffect(() => {
    const onKey = (e) => {
      if (showResult || showArchive) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); doTurn(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); doTurn(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doTurn, showResult, showArchive]);

  const restart = useCallback(() => {
    // An abandoned attempt counts as a try; replays after a solve don't change it.
    if (moves > 0 && !solved) recordTry(NS, number, [], false);
    setPos(identity);
    setMoves(0);
    setSolved(false);
    setHovered(null);
    setShowResult(false);
    sound.resetPhrase();
  }, [identity, moves, solved, number]);

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

  const litPips = showFloor && distance != null ? Math.min(PIP_COUNT, distance * 2) : 0;
  const allLit = solved;

  const dateLabel = dateForNumber(number).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const glowing = useMemo(() => {
    if (!hovered) return new Set();
    return new Set([pos[hovered.arm], pos[hovered.ring]]);
  }, [hovered, pos]);

  return (
    <div className="facet">
      <ArchiveDrawer
        open={showArchive}
        onClose={() => setShowArchive(false)}
        current={number}
        onPick={pickPuzzle}
        List={ArchiveList}
      />
      {showResult && <FacetResult ns={NS} number={number} onClose={closeResult} onReplay={restart} />}

      <div className="facet__stage-wrap">
        <header className="fc-bar">
          <button type="button" className="fc-chip" onClick={() => onNavigate('/')} aria-label="Back to all games">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M13 8H3M7 4L3 8l4 4" fill="none" stroke="currentColor"
                    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Games</span>
          </button>
          <div className="fc-barend">
            {isSolved(readResults(NS)[number]) && (
              <button type="button" className="fc-chip" onClick={() => setShowResult(true)} aria-label="Your result">
                <ResultIcon name="star" />
              </button>
            )}
            <button type="button" className="fc-chip" onClick={() => setShowArchive(true)} aria-label="Open archive">
              <span>#{number}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <div className="fc-masthead">
          <h1 className="fc-title">Facet</h1>
          <span className="fc-stamp">{dateLabel}</span>
        </div>

        <div className="fc-score">
          <div>
            <div className="fc-label">moves</div>
            <div className="fc-moves">
              {moves} <span>/ par {ready ? par : '—'}</span>
            </div>
          </div>
          <span className="fc-label">
            {showFloor && distance != null && !solved ? `${distance} from solved` : ''}
          </span>
        </div>

        <div className="fc-stage">
          <div className="fc-board">
            {PIPS.map(([x, y], i) => (
              <div
                key={`pip-${i}`}
                className={`fc-pip${allLit || i < litPips ? ' is-on' : ''}${highlight === 'floor' ? ' is-pulsing' : ''}`}
                style={{ left: `${x}px`, top: `${y}px` }}
              />
            ))}

            {ready && colours && pos.map((tileId, position) => {
              const colour = colours[tileId] === 0 ? TARGET : JUNK[colours[tileId] - 1];
              const [row, col] = RC[position];
              const x = col * PITCH;
              const y = row * PITCH;
              return (
                <div
                  key={`tile-${tileId}`}
                  className={`fc-block${glowing.has(tileId) ? ' is-glowing' : ''}${highlight === 'swaps' && position >= 8 ? ' is-pulsing' : ''}`}
                  style={{
                    background: darken(colour, 0.3),
                    boxShadow: extrusion(colour),
                    transform: `translate3d(${x}px,${y}px,0)`,
                    zIndex: Math.round(x + y),
                  }}
                >
                  <div className="fc-face" style={{ background: colour }} />
                </div>
              );
            })}

            <div
              className="fc-block fc-centre"
              style={{
                background: darken(TARGET, 0.3),
                boxShadow: extrusion(TARGET),
                transform: `translate3d(${2 * PITCH}px,${2 * PITCH}px,0)`,
                zIndex: 240,
              }}
            >
              <div className="fc-face" style={{ background: darken(TARGET, 0.16) }} />
              <div className="fc-pin" />
            </div>

            <TurnBlock dir={-1} col={0} row={4} pulsing={highlight === 'turns'} onTurn={doTurn} />
            <TurnBlock dir={1} col={4} row={0} pulsing={highlight === 'turns'} onTurn={doTurn} />

            {SWAPS.map(([arm, ring]) => {
              const [row, col] = RC[arm];
              return (
                <div
                  key={`hit-${arm}`}
                  className="fc-hit"
                  style={{ left: `${col * PITCH}px`, top: `${row * PITCH}px` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Swap outer block ${arm} inward`}
                  onPointerEnter={() => { if (!solved) { setHovered({ arm, ring }); sound.tick(); } }}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => doSwap(arm, ring)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSwap(arm, ring); } }}
                />
              );
            })}
          </div>
        </div>

        {tutorial ? (
          <div className="fc-card">
            <p>{tutorial.text}</p>
            <div className="fc-cardfoot">
              <button type="button" onClick={() => advanceTutorial(false)}>
                {tutStep === TUTORIAL.length - 1 ? 'Start' : 'Next'}
              </button>
              <button type="button" onClick={() => advanceTutorial(true)}>Skip</button>
              <span className="fc-label">{tutStep + 1} / {TUTORIAL.length}</span>
            </div>
          </div>
        ) : (
          <p className="fc-msg">
            {!ready ? 'Measuring every scramble…'
              : solved ? (
                moves === par ? (
                  <>
                    <b className="is-ok">Solved in {moves} — exactly par.</b>{' '}
                    No shorter route exists; the search proved it before you started.
                  </>
                ) : (
                  <>
                    <b>Solved in {moves}.</b> Par was {par}. Finishing is the easy half — the puzzle is the route.
                  </>
                )
              ) : (
                <>Par {par}. Swap blocks inward and turn the ring until the eight around the centre all match it.</>
              )}
          </p>
        )}

        <div className="fc-toggles">
          <label>
            <input type="checkbox" checked={showFloor}
                   onChange={(e) => setShowFloor(e.target.checked)} />
            Floor shows distance
          </label>
          <label>
            <input type="checkbox" checked={soundOn}
                   onChange={(e) => { setSoundOn(e.target.checked); sound.setEnabled(e.target.checked); }} />
            Sound
          </label>
        </div>

        <div className="fc-actions">
          <button type="button" onClick={restart}>Restart</button>
          <button type="button" onClick={() => { setTutStep(0); }}>How to play</button>
        </div>
      </div>
    </div>
  );
}

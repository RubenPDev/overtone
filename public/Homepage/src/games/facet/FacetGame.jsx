import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  N, PITCH, RC, SWAPS,
  FAR, applyPerm, buildTables, swapPerm, turnPerm, distanceOf, isBuilt,
  scrambleFor, settledCells, solvedPosition, todayNumber, lastNumber, dateForNumber, puzzlePath,
} from './solver.js';
import { sound } from './sound.js';
import {
  hasLiked, helpSeen, isSolved, markHelpSeen, markLiked, readBest, readResults, readTries, recordBest, recordPlay, recordTry,
} from '../../lib/progress.js';
import { reportLike, reportResult, reportStart } from '../../lib/stats.js';
import { countOwnLike } from '../../lib/useLikes.js';
import { HEART_PATH } from '../../components/LikeCount.jsx';
import GameBar, { PuzzleStepper, RestartIcon } from '../../components/GameBar.jsx';
import ArchiveDrawer from '../cadence/ArchiveDrawer.jsx';
import { ResultIcon } from '../cadence/CadenceResult.jsx';
import ArchiveList from './ArchiveList.jsx';
import FacetResult from './FacetResult.jsx';
import './facet.css';

const NS = 'facet';
const RESULT_DELAY_MS = 1350; // lets the win chime ring and the wave cross the board

/* What the plate and blocks cover on screen at scale 1, once tilted. */
const BOARD_W = 490; // the height depends on the tilt, so it's set in the CSS

/* How far along the winning wave a block is: 0 at the screen's left corner, 8 at the right. */
const waveStep = (col, row) => col - row + 4;

const ARROW_CW = { arc: 'M33 13.9A14 14 0 1 1 19 13.9', head: 'M25.9 9.9L21.8 18.6L16.3 9.1Z' };
const ARROW_CCW = { arc: 'M19 13.9A14 14 0 1 0 33 13.9', head: 'M26.1 9.9L30.2 18.6L35.7 9.1Z' };

/* A plain block that acts as a button rather than a piece of the puzzle. */
function ControlBlock({ col, row, label, toggled, pulsing, onPress, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className={`fc-block fc-control${pressed ? ' is-pressed' : ''}${pulsing ? ' is-pulsing' : ''}`}
      style={{
        transform: `translate3d(${col * PITCH}px,${row * PITCH}px,0)`,
        zIndex: Math.round(col * PITCH + row * PITCH),
        '--fc-wave': waveStep(col, row),
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={toggled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onPress}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(); } }}
    >
      <div className="fc-face" />
      {children}
    </div>
  );
}

function TurnBlock({ dir, col, row, pulsing, onTurn }) {
  const { arc, head } = dir > 0 ? ARROW_CW : ARROW_CCW;
  return (
    <ControlBlock col={col} row={row} pulsing={pulsing} onPress={() => onTurn(dir)}
                  label={dir > 0 ? 'Turn ring right' : 'Turn ring left'}>
      {/* The arrow lies in the plane the ring turns in, so the projection
          squashing it into an ellipse is the point, not a flaw. */}
      <svg className="fc-icon" viewBox="0 0 52 52" aria-hidden="true">
        <path d={arc} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d={head} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </ControlBlock>
  );
}

function SoundBlock({ col, row, on, onToggle }) {
  return (
    <ControlBlock col={col} row={row} label="Sound" toggled={on} onPress={onToggle}>
      {/* Turned to face the player, since a speaker on its side reads as nothing. */}
      <svg className={`fc-icon fc-icon--upright${on ? '' : ' is-off'}`} viewBox="0 0 52 52" aria-hidden="true">
        <path d="M11 21h6l9-7.5v25L17 31h-6z" fill="currentColor" stroke="currentColor"
              strokeWidth="2" strokeLinejoin="round" />
        <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
          {on ? (
            <>
              <path d="M31.5 20.5a8 8 0 0 1 0 11" />
              <path d="M36.5 15.5a15 15 0 0 1 0 21" />
            </>
          ) : (
            <path d="M32 21l9 10M41 21l-9 10" />
          )}
        </g>
      </svg>
    </ControlBlock>
  );
}

function LikeBlock({ col, row, liked, onLike }) {
  return (
    <ControlBlock col={col} row={row} label={liked ? 'Liked' : 'Like Facet'} toggled={liked} onPress={onLike}>
      <svg className="fc-icon fc-icon--upright" viewBox="0 0 52 52" aria-hidden="true">
        <path d={HEART_PATH} className={liked ? 'is-liked' : undefined}
              fill={liked ? 'currentColor' : 'none'} stroke="currentColor"
              strokeWidth="3.5" strokeLinejoin="round" />
      </svg>
    </ControlBlock>
  );
}

/* A double arrow lying on the board between two neighbouring cells, at the height of their tops. */
function SwapArrow({ from, to }) {
  const [r1, c1] = RC[from];
  const [r2, c2] = RC[to];
  const left = Math.min(c1, c2) * PITCH;
  const top = Math.min(r1, r2) * PITCH;
  const w = Math.abs(c1 - c2) * PITCH + 52;
  const h = Math.abs(r1 - r2) * PITCH + 52;
  // From one cell's centre to the other's, pulled in so the heads sit on the faces.
  const ax = (c1 - Math.min(c1, c2)) * PITCH + 26;
  const ay = (r1 - Math.min(r1, r2)) * PITCH + 26;
  const bx = (c2 - Math.min(c1, c2)) * PITCH + 26;
  const by = (r2 - Math.min(r1, r2)) * PITCH + 26;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const end = (x, y, dir) => {
    const tx = x + ux * dir * 8;
    const ty = y + uy * dir * 8;
    return `M${tx - ux * dir * 9 - uy * 7} ${ty - uy * dir * 9 + ux * 7}L${tx} ${ty}L${tx - ux * dir * 9 + uy * 7} ${ty - uy * dir * 9 - ux * 7}`;
  };
  return (
    <svg className="fc-swaparrow" style={{ left, top, width: w, height: h }} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {['fc-swaparrow__edge', 'fc-swaparrow__line'].map((cls) => (
          <g key={cls} className={cls}>
            <path d={`M${ax + ux * 6} ${ay + uy * 6}L${bx - ux * 6} ${by - uy * 6}`} />
            <path d={end(ax, ay, -1)} />
            <path d={end(bx, by, 1)} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* The tutorial acts out each kind of move on the board itself, then puts it back. */
const DEMO_SWAPS = [[9, 1], [12, 3], [15, 5], [18, 7]];
const DEMO_STEPS = [[0, 'show'], [700, 'moved'], [1900, 'show'], [2900, null]];
const DEMO_EVERY = 3300;
const FLASH_MS = 450;

const TUTORIAL = [
  {
    text: 'Tap any outer block and it trades places with the face cell it touches, as the board is showing. With a mouse, hover first and both light up so you can see the pair.',
    highlight: 'swaps',
  },
  {
    text: 'The plain blocks at the left and right corners turn the ring of eight a quarter turn. The centre never moves — it sets the colour you are aiming for.',
    highlight: 'turns',
  },
  {
    text: 'To finish, fill the eight around the centre with its colour and make each outer row of three a single colour. Any colour can take any row, and whatever is already right glows. The board glows a little warmer the closer you get, and each move sounds a lower note.',
    highlight: 'glow',
  },
];

export default function FacetGame({ puzzleNumber, onNavigate, isDark, onToggleTheme }) {
  const today = useMemo(() => todayNumber(), []);
  // A URL can name a puzzle whose day hasn't come yet (or never existed).
  const invalidUrl = puzzleNumber != null && (puzzleNumber < 1 || puzzleNumber > lastNumber());
  const number = puzzleNumber == null || invalidUrl ? today : puzzleNumber;
  const isToday = number === today;
  const ahead = number > today; // only reachable in developer mode, and never counted

  useEffect(() => {
    if (invalidUrl) onNavigate('/facet', { replace: true });
  }, [invalidUrl, onNavigate]);

  /* The search table is a module singleton, but building it blocks for
     ~100ms, so paint the shell first and fill it in on the next tick. */
  const [ready, setReady] = useState(() => isBuilt());
  useEffect(() => {
    if (ready) return undefined;
    const id = setTimeout(() => { buildTables(); setReady(true); }, 0);
    return () => clearTimeout(id);
  }, [ready]);

  const puzzle = useMemo(() => (ready ? scrambleFor(number) : null), [ready, number]);

  const identity = useMemo(() => Array.from({ length: N }, (_, i) => i), []);
  const [pos, setPos] = useState(identity);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [restored, setRestored] = useState(false); // solved on an earlier visit, not just now
  const [hovered, setHovered] = useState(null);
  const [flash, setFlash] = useState(null); // the two blocks a tap just swapped
  const [demo, setDemo] = useState(null);   // the tutorial's move: { pair, moved } or { turn, moved }
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [liked, setLiked] = useState(() => hasLiked(NS));
  const [tutStep, setTutStep] = useState(() => (helpSeen(NS) ? -1 : 0));
  const [showArchive, setShowArchive] = useState(false);
  const [showResult, setShowResult] = useState(() => isSolved(readResults(NS)[number]));
  const closeResult = useCallback(() => setShowResult(false), []);
  const busy = useRef(false);
  const stageRef = useRef(null);

  // CSS can't turn a box's size into a plain scale factor, so measure it here.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const fit = () => {
      const boardH = parseFloat(getComputedStyle(stage).getPropertyValue('--fc-board-h'));
      const scale = Math.min(stage.clientWidth / BOARD_W, stage.clientHeight / boardH);
      stage.style.setProperty('--fc-scale', scale.toFixed(3));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const colours = puzzle ? puzzle.colours : null;
  const par = puzzle ? puzzle.par : 0;

  /* A puzzle already solved opens solved, on a default layout since the player's
     own isn't kept. Set while rendering, so the scramble never gets painted first. */
  const [loaded, setLoaded] = useState(null);
  if (puzzle !== loaded) {
    const done = puzzle !== null && isSolved(readResults(NS)[number]);
    setLoaded(puzzle);
    setPos(done ? solvedPosition(puzzle.colours) : identity);
    setMoves(done ? readBest(NS)[number] ?? puzzle.par : 0);
    setSolved(done);
    setRestored(done);
  }

  // Coming back to a solved puzzle shows how it went, not a blank board.
  useEffect(() => {
    setShowResult(isSolved(readResults(NS)[number]));
  }, [number]);

  // The start needs no search: par is that board's distance, however far out it is.
  const distance = useMemo(() => {
    if (!colours) return null;
    return moves === 0 ? par : distanceOf(pos, colours);
  }, [pos, colours, moves, par]);

  useEffect(() => {
    if (distance !== 0 || solved || !colours) return;
    setSolved(true);
    sound.win();
    recordBest(NS, number, moves);
    const firstSolve = recordTry(NS, number, [], true);
    recordPlay(NS, { puzzleNumber: number, solved: true, isToday });
    if (!ahead) reportResult(NS, number, 'solved', { tries: firstSolve ? readTries(NS, number)?.count : null, isToday });
  }, [distance, solved, colours, number, isToday, ahead, moves]);

  // Restarting during the delay clears `solved`, and with it this timer.
  useEffect(() => {
    if (!solved || restored) return undefined;
    const t = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(t);
  }, [solved, restored]);

  // Only when the count changes: a switch of puzzle mustn't count as a start.
  useEffect(() => {
    if (moves === 1 && !ahead) reportStart(NS, number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves]);

  const doSwap = useCallback((arm, ring) => {
    if (solved || busy.current || !colours) return;
    sound.unlock();
    setPos((p) => applyPerm(p, swapPerm(arm, ring)));
    setMoves((m) => m + 1);
    setFlash([pos[arm], pos[ring]]);
    sound.swap();
  }, [solved, colours, pos]);

  // A touch screen has no hover, so the pair lights up as it lands instead.
  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  // Each move rings a note for how far is left, settling lower as the board comes
  // right, so the win chord lands as its resolution.
  useEffect(() => {
    if (moves > 0 && distance > 0) sound.note(distance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves]);

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
    setRestored(false);
    setHovered(null);
    setShowResult(false);
  }, [identity, moves, solved, number]);

  const pickPuzzle = useCallback((n) => {
    setShowArchive(false);
    onNavigate(puzzlePath(n));
  }, [onNavigate]);

  const toggleSound = useCallback(() => {
    sound.unlock();
    sound.setEnabled(!sound.enabled);
    setSoundOn(sound.enabled);
  }, []);

  const like = useCallback(() => {
    if (hasLiked(NS)) return;
    sound.unlock();
    sound.tick();
    markLiked(NS);
    setLiked(true);
    countOwnLike();
    reportLike(NS);
  }, []);

  // A like that couldn't be sent at the time goes on the next visit.
  useEffect(() => {
    if (hasLiked(NS)) reportLike(NS);
  }, []);

  const advanceTutorial = useCallback((skip) => {
    sound.tick();
    const next = skip ? TUTORIAL.length : tutStep + 1;
    setTutStep(next);
    if (next >= TUTORIAL.length) markHelpSeen(NS);
  }, [tutStep]);

  const tutorial = tutStep >= 0 && tutStep < TUTORIAL.length ? TUTORIAL[tutStep] : null;
  const highlight = tutorial ? tutorial.highlight : null;

  useEffect(() => {
    if (highlight !== 'swaps' && highlight !== 'turns') { setDemo(null); return undefined; }
    let round = 0;
    let timers = [];
    const play = () => {
      const pair = DEMO_SWAPS[round % DEMO_SWAPS.length];
      round += 1;
      timers = DEMO_STEPS.map(([at, phase]) => setTimeout(() => {
        if (!phase) setDemo(null);
        else if (highlight === 'swaps') setDemo({ pair, moved: phase === 'moved' });
        else setDemo({ turn: true, moved: phase === 'moved' });
      }, at));
    };
    play();
    const every = setInterval(play, DEMO_EVERY);
    return () => { clearInterval(every); timers.forEach(clearTimeout); setDemo(null); };
  }, [highlight]);

  // How near the board is to solved, from 0 at the scramble to 1 once it's done.
  const near = solved ? 1 : distance == null || !par ? 0 : Math.max(0, 1 - distance / par);

  const dateLabel = dateForNumber(number).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const settled = useMemo(() => (colours ? settledCells(pos, colours) : []), [pos, colours]);

  const glowing = useMemo(() => {
    if (hovered) return new Set([pos[hovered.arm], pos[hovered.ring]]);
    if (demo?.pair) return new Set([pos[demo.pair[0]], pos[demo.pair[1]]]);
    return new Set(flash ?? []);
  }, [hovered, demo, flash, pos]);

  // What the board shows: the real position, or the tutorial's move played on it.
  const shown = useMemo(() => {
    if (!demo?.moved) return pos;
    return applyPerm(pos, demo.pair ? swapPerm(demo.pair[0], demo.pair[1]) : turnPerm(1));
  }, [demo, pos]);

  return (
    <div className="facet">
      <ArchiveDrawer
        open={showArchive}
        onClose={() => setShowArchive(false)}
        current={number}
        onPick={pickPuzzle}
        finished={solved}
        List={ArchiveList}
      />
      {showResult && <FacetResult ns={NS} number={number} onClose={closeResult} onReplay={restart} />}

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
          <h1 className="gamehead__title">Facet</h1>
          <span className="gamehead__stamp">{dateLabel}</span>
        </div>

        <div className="fc-score">
          <div>
            <div className="fc-label">Moves</div>
            <div className="fc-moves">
              {moves} <span>/ par {ready ? par : '—'}</span>
            </div>
          </div>
          <span className="fc-label">
            {distance != null && !solved ? `${moves > 0 && distance >= FAR ? `${FAR}+` : distance} from solved` : ''}
          </span>
        </div>

        <div className="fc-stage" ref={stageRef}>
          <div
            className={`fc-board${solved && !restored ? ' is-waving' : ''}${demo ? ' is-demo' : ''}`}
            style={{ '--fc-near': highlight === 'glow' ? 0.7 : near }}
          >
            <div className="fc-plate" />
            <div className={`fc-glow${highlight === 'glow' ? ' is-pulsing' : ''}`} />

            {ready && colours && shown.map((tileId, position) => {
              const [row, col] = RC[position];
              const x = col * PITCH;
              const y = row * PITCH;
              return (
                <div
                  key={`tile-${tileId}`}
                  className={`fc-block fc-tone-${colours[tileId]}${settled[position] && !demo?.moved ? ' is-settled' : ''}${glowing.has(tileId) ? ' is-glowing' : ''}`}
                  data-tone={colours[tileId]}
                  style={{
                    transform: `translate3d(${x}px,${y}px,0)`,
                    zIndex: Math.round(x + y),
                    '--fc-wave': waveStep(col, row),
                  }}
                >
                  <div className="fc-face" />
                </div>
              );
            })}

            <div
              className={`fc-block fc-centre fc-tone-centre${solved ? ' is-settled' : ''}`}
              style={{
                transform: `translate3d(${2 * PITCH}px,${2 * PITCH}px,0)`,
                zIndex: 240,
                '--fc-wave': waveStep(2, 2),
              }}
            >
              <div className="fc-face" />
            </div>

            {demo?.pair && <SwapArrow key={demo.pair[0]} from={demo.pair[0]} to={demo.pair[1]} />}

            <SoundBlock col={0} row={0} on={soundOn} onToggle={toggleSound} />
            <TurnBlock dir={-1} col={0} row={4} pulsing={highlight === 'turns'} onTurn={doTurn} />
            <TurnBlock dir={1} col={4} row={0} pulsing={highlight === 'turns'} onTurn={doTurn} />
            <LikeBlock col={4} row={4} liked={liked} onLike={like} />

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
              <button type="button" className="cad__btn cad__btn--primary" onClick={() => advanceTutorial(false)}>
                {tutStep === TUTORIAL.length - 1 ? 'Start' : 'Next'}
              </button>
              <button type="button" className="cad__btn" onClick={() => advanceTutorial(true)}>Skip</button>
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
                <>Par {par}. Match the eight around the centre to it, and make each outer row of three a single colour.</>
              )}
          </p>
        )}

        <div className="fc-actions">
          <button type="button" className="cad__btn cad__btn--primary" onClick={() => { setTutStep(0); }}>
            How to play
          </button>
          <button type="button" className="cad__btn cad__btn--round" onClick={restart} aria-label="Restart" title="Restart">
            <RestartIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createThrottle } from '../../core/clock';
import { simHost } from '../../game/runtime';
import type { PlantState } from '../../sim';

type Draw = (g: CanvasRenderingContext2D, s: Readonly<PlantState>, w: number, h: number) => void;

/**
 * A big wall screen whose canvas texture is redrawn from the sim twice a
 * second inside useFrame (no React renders involved). The screen sits clearly
 * in front of its bezel so the two never z-fight.
 */
export function WallDisplay({
  width,
  height,
  draw,
  position,
  rotation,
}: {
  width: number;
  height: number;
  draw: Draw;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const { canvas, tex, mat, throttle } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round((1024 * height) / width);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.25, 1.25, 1.25),
      toneMapped: false,
    });
    return { canvas, tex, mat, throttle: createThrottle(2) };
  }, [width, height]);

  useEffect(() => () => (tex.dispose(), mat.dispose()), [tex, mat]);

  useFrame((_, dt) => {
    if (!throttle(dt)) return;
    draw(canvas.getContext('2d')!, simHost.state, canvas.width, canvas.height);
    tex.needsUpdate = true;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[width + 0.36, height + 0.36, 0.12]} />
        <meshStandardMaterial color="#141b23" roughness={0.45} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.012]} material={mat}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

const FONT = '"Oxanium", "Rajdhani", sans-serif';
const pad2 = (n: number) => String(n).padStart(2, '0');

function frame(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  tag?: { text: string; color: string },
) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#0d3446');
  grd.addColorStop(1, '#071b25');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(95,227,255,0.08)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  g.fillStyle = '#5fe3ff';
  g.fillRect(36, 34, 8, 44);
  g.fillStyle = '#d8f6ff';
  g.font = `700 46px ${FONT}`;
  g.textBaseline = 'middle';
  g.fillText(title, 60, 57);
  if (tag) {
    g.font = `700 30px ${FONT}`;
    const tw = g.measureText(tag.text).width;
    g.fillStyle = tag.color;
    g.fillRect(w - tw - 72, 36, tw + 36, 42);
    g.fillStyle = '#071b25';
    g.fillText(tag.text, w - tw - 54, 58);
  }
  g.textBaseline = 'alphabetic';
}

function pentagon(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

/** All 12 cells in two rows: burn-up fill, number, burn-up % and rod position bar. */
export const drawCellMap: Draw = (g, s, w, h) => {
  const due = s.cells.findIndex((c) => c.loaded && c.burnup > 0.9);
  const empty = s.cells.findIndex((c) => !c.loaded);
  frame(
    g,
    w,
    h,
    'CORE CELL MAP',
    due >= 0
      ? { text: `CELL ${pad2(due + 1)} · SWAP DUE`, color: '#ffb35c' }
      : empty >= 0
        ? { text: `CELL ${pad2(empty + 1)} · EMPTY`, color: '#ff7a7a' }
        : { text: 'ALL CELLS NOMINAL', color: '#6dffb6' },
  );
  const cols = 6;
  const cellW = (w - 80) / cols;
  const rowH = (h - 110) / 2;
  s.cells.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = 40 + cellW * (col + 0.5);
    const cy = 110 + rowH * row + rowH * 0.42;
    const r = Math.min(cellW, rowH) * 0.3;
    const hot = c.loaded && c.burnup > 0.9;
    pentagon(g, cx, cy, r);
    g.fillStyle = !c.loaded
      ? '#0c1a22'
      : hot
        ? 'rgba(255,179,92,0.45)'
        : `rgba(95,227,255,${0.18 + (1 - c.burnup) * 0.55})`;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = !c.loaded ? '#ff7a7a' : hot ? '#ffb35c' : '#5fe3ff';
    g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = `700 ${Math.round(r * 0.62)}px ${FONT}`;
    g.fillText(pad2(i + 1), cx, cy + r * 0.22);
    g.font = `600 ${Math.round(r * 0.5)}px ${FONT}`;
    g.fillStyle = hot ? '#ffcf96' : '#bfefff';
    g.fillText(c.loaded ? `${Math.round(c.burnup * 100)}%` : 'EMPTY', cx, cy + r + r * 0.62);
    // Rod insertion bar under each cell.
    const bw = cellW * 0.6;
    const by = cy + r + r * 0.86;
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(cx - bw / 2, by, bw, 8);
    g.fillStyle = '#f2b81f';
    g.fillRect(cx - bw / 2, by, bw * s.rods[i]!.insertion, 8);
    g.textAlign = 'left';
  });
};

/** Net output: a big number and a rolling trend. */
export function makeOutputDrawer(): Draw {
  const history: number[] = [];
  return (g, s, w, h) => {
    history.push(s.output);
    if (history.length > 150) history.shift();
    const trend = history.length > 10 ? s.output - history[history.length - 10]! : 0;
    frame(
      g,
      w,
      h,
      'NET OUTPUT',
      s.alarms.length ? { text: 'ALARM', color: '#ff7a7a' } : { text: 'GRID SYNC', color: '#6dffb6' },
    );
    g.fillStyle = '#ffffff';
    g.font = `700 150px ${FONT}`;
    const num = Math.round(s.output).toLocaleString('en-US');
    g.fillText(num, 52, 250);
    const nw = g.measureText(num).width;
    g.fillStyle = '#5fe3ff';
    g.font = `700 54px ${FONT}`;
    g.fillText('MWe', 72 + nw, 248);
    g.font = `600 34px ${FONT}`;
    g.fillStyle = trend >= 0 ? '#6dffb6' : '#ffb35c';
    g.fillText(`${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend).toFixed(1)}`, 72 + nw, 196);
    g.fillStyle = '#9fc6d6';
    g.fillText(
      `${Math.round(s.thermalPower).toLocaleString('en-US')} MWt · ${s.coreTemp.toFixed(0)} °C · ${s.pressure.toFixed(1)} MPa`,
      56,
      306,
    );
    // Trend graph across the bottom.
    const top = 330;
    const bottom = h - 26;
    const min = Math.min(...history) - 20;
    const max = Math.max(...history) + 20;
    g.strokeStyle = 'rgba(95,227,255,0.25)';
    g.lineWidth = 2;
    g.strokeRect(40, top, w - 80, bottom - top);
    g.beginPath();
    history.forEach((v, i) => {
      const x = 40 + (i / 149) * (w - 80);
      const y = bottom - ((v - min) / (max - min || 1)) * (bottom - top);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.strokeStyle = '#5fe3ff';
    g.lineWidth = 5;
    g.stroke();
  };
}

/** Rod positions: 12 vertical bars, inserted portion in hazard yellow. */
export const drawRods: Draw = (g, s, w, h) => {
  const avg = s.rods.reduce((a, r) => a + r.insertion, 0) / 12;
  frame(g, w, h, 'ROD POSITIONS', {
    text: `${Math.round(avg * 100)}% IN`,
    color: s.scrammed ? '#ff7a7a' : '#f2b81f',
  });
  const bw = (w - 120) / 12;
  const top = 116;
  const bottom = h - 64;
  s.rods.forEach((r, i) => {
    const x = 60 + i * bw + bw * 0.2;
    const width = bw * 0.6;
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(x, top, width, bottom - top);
    g.fillStyle = r.target !== r.insertion ? '#ffd76a' : '#f2b81f';
    g.fillRect(x, top, width, (bottom - top) * r.insertion);
    // Target tick.
    g.fillStyle = '#ffffff';
    g.fillRect(x - 6, top + (bottom - top) * r.target - 2, width + 12, 4);
    g.font = `700 30px ${FONT}`;
    g.textAlign = 'center';
    g.fillStyle = '#cfefff';
    g.fillText(pad2(i + 1), x + width / 2, h - 22);
    g.textAlign = 'left';
  });
};

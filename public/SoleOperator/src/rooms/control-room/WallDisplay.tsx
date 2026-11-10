import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createThrottle } from '../../core/clock';
import { simHost } from '../../game/runtime';
import type { PlantState } from '../../sim';

type Draw = (g: CanvasRenderingContext2D, s: Readonly<PlantState>, w: number, h: number) => void;

/**
 * A big wall screen whose canvas texture is redrawn from the sim twice a
 * second, inside useFrame (no React renders involved).
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
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: new THREE.Color(1.5, 1.5, 1.5),
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
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[width + 0.3, height + 0.3, 0.08]} />
        <meshStandardMaterial color="#141b23" roughness={0.5} />
      </mesh>
      <mesh material={mat}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

const FONT = '"Oxanium", "Rajdhani", sans-serif';

function frame(g: CanvasRenderingContext2D, w: number, h: number, title: string) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#0a2a38');
  grd.addColorStop(1, '#061820');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(95,227,255,0.12)';
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 48) g.strokeRect(x, 0, 48, h);
  g.fillStyle = '#9fe9ff';
  g.font = `700 44px ${FONT}`;
  g.fillText(title, 40, 70);
}

/** Pentagons for all 12 cells coloured by burn-up; spent cells in amber. */
export const drawCellMap: Draw = (g, s, w, h) => {
  frame(g, w, h, 'CORE CELL MAP');
  const due = s.cells.findIndex((c) => c.loaded && c.burnup > 0.9);
  g.fillStyle = '#ffb35c';
  g.font = `600 32px ${FONT}`;
  if (due >= 0) g.fillText(`CELL ${String(due + 1).padStart(2, '0')} · SWAP DUE`, w - 420, 70);
  s.cells.forEach((c, i) => {
    const cx = 80 + i * ((w - 160) / 11);
    const cy = h * 0.6;
    const r = 30;
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    const hot = c.loaded && c.burnup > 0.9;
    g.fillStyle = !c.loaded
      ? '#10202a'
      : hot
        ? 'rgba(255,179,92,0.35)'
        : `rgba(95,227,255,${0.15 + (1 - c.burnup) * 0.45})`;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = hot ? '#ffb35c' : '#5fe3ff';
    g.stroke();
    g.fillStyle = '#cfefff';
    g.font = `500 22px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(String(i + 1).padStart(2, '0'), cx, cy + 66);
    g.fillText(c.loaded ? `${Math.round(c.burnup * 100)}%` : '—', cx, cy - 44);
    g.textAlign = 'left';
  });
};

/** Net output with a rolling trace. */
export function makeOutputDrawer(): Draw {
  const history: number[] = [];
  return (g, s, w, h) => {
    history.push(s.output);
    if (history.length > 120) history.shift();
    frame(g, w, h, 'NET OUTPUT');
    g.fillStyle = '#ffffff';
    g.font = `700 92px ${FONT}`;
    g.fillText(`${Math.round(s.output).toLocaleString('en-US')}`, 40, h - 60);
    g.fillStyle = '#5fe3ff';
    g.font = `600 40px ${FONT}`;
    g.fillText('MWe', 330, h - 62);
    const max = 1600;
    g.strokeStyle = '#5fe3ff';
    g.lineWidth = 5;
    g.beginPath();
    history.forEach((v, i) => {
      const x = 420 + (i / 119) * (w - 460);
      const y = h - 40 - (v / max) * (h - 140);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    g.stroke();
  };
}

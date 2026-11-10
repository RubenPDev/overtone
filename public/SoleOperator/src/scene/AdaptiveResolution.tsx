import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

/**
 * Resolution governor. Learns the display's refresh interval from the fastest
 * frames it sees, then lowers the pixel ratio in 0.25 steps (down to 0.75) when
 * frames run consistently slower than that, and raises it again after a
 * sustained stretch of headroom. Keeps the frame rate at the monitor's refresh
 * on big screens instead of rendering more pixels than the GPU can afford.
 */
const MIN_DPR = 0.75;

export function AdaptiveResolution({ max }: { max: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ ema: 1 / 60, best: 1 / 30, slow: 0, fast: 0, dpr: max, cooldown: 2 });

  useFrame((_, dt) => {
    if (dt <= 0 || dt > 0.25) return; // tab switches and hitches don't count
    const s = st.current;
    s.ema += (dt - s.ema) * 0.08;
    // The refresh interval is roughly the fastest frame we ever get (floored at 240 Hz).
    s.best = Math.max(1 / 240, Math.min(s.best, s.ema));
    s.cooldown -= dt;
    if (s.cooldown > 0) return;

    if (s.ema > s.best * 1.3) {
      s.slow += dt;
      s.fast = 0;
    } else if (s.ema < s.best * 1.08) {
      s.fast += dt;
      s.slow = 0;
    } else {
      s.slow = 0;
      s.fast = 0;
    }

    if (s.slow > 1.5 && s.dpr > MIN_DPR) {
      s.dpr = Math.max(MIN_DPR, s.dpr - 0.25);
      setDpr(s.dpr);
      s.slow = 0;
      s.cooldown = 2;
    } else if (s.fast > 8 && s.dpr < max) {
      s.dpr = Math.min(max, s.dpr + 0.25);
      setDpr(s.dpr);
      s.fast = 0;
      s.cooldown = 4;
    }
  });
  return null;
}

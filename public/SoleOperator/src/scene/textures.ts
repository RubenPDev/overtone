import * as THREE from 'three';

/**
 * Procedural canvas textures, generated once and cached. They keep the greybox
 * free of image downloads; real art can replace them room by room.
 */
const cache = new Map<string, THREE.Texture>();

function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  srgb = true,
) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Soft radial falloff (white → transparent) for additive light pools on floors. */
export function glowTexture() {
  return canvasTexture('glow', 256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  });
}

/** Floor tiles: subtle panel seams, tiled with `repeat` = metres / 2. */
export function floorTexture() {
  const t = canvasTexture('floor', 256, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 253, 253);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    g.strokeRect(5, 5, 246, 246);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Yellow/black hazard stripes. */
export function hazardTexture() {
  const t = canvasTexture('hazard', 128, 128, (g) => {
    g.fillStyle = '#16181b';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f2b81f';
    for (let i = -2; i < 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 128);
      g.lineTo(i * 64 + 32, 128);
      g.lineTo(i * 64 + 96, 0);
      g.lineTo(i * 64 + 64, 0);
      g.closePath();
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Opaque → transparent along U, for corridor stubs fading into darkness. */
export function fadeTexture() {
  return canvasTexture('fade', 256, 4, (g) => {
    const grd = g.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 4);
  });
}

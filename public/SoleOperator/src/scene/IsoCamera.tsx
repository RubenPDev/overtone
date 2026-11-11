import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { player } from '../game/runtime';
import { useApp } from '../state/app';
import { stage } from './stage';
import { viewOf } from '../rooms/registry';
import { useWorld } from '../state/world';

/** 45° yaw, 30° pitch: the classic 2:1 dimetric "isometric" game angle. */
export const CAM_YAW = Math.PI / 4;
export const CAM_PITCH = (30 * Math.PI) / 180;
const DIST = 120;
const OFFSET = new THREE.Vector3(
  Math.sin(CAM_YAW) * Math.cos(CAM_PITCH),
  Math.sin(CAM_PITCH),
  Math.cos(CAM_YAW) * Math.cos(CAM_PITCH),
).multiplyScalar(DIST);

export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 2.6;
const ZOOM_DEFAULT = 1.1;

/**
 * Orthographic follow camera. Fixed angle; smoothly follows the player; scroll
 * zooms within limits; the look-at point is clamped to the mounted space's frame,
 * and only that space is ever mounted, so a second room can never be in view.
 */
export function IsoCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const target = useRef(new THREE.Vector3(player.pos.x, 0, player.pos.z));
  const zoom = useRef(ZOOM_DEFAULT);
  const zoomGoal = useRef(ZOOM_DEFAULT);
  const snapped = useRef(-1);

  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (useApp.getState().overlay) return;
      e.preventDefault();
      zoomGoal.current = THREE.MathUtils.clamp(
        zoomGoal.current * Math.exp(-e.deltaY * 0.0012),
        ZOOM_MIN,
        ZOOM_MAX,
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [gl]);

  useFrame((_, dt) => {
    const layout = stage.layout;
    // Base zoom: pixels per metre so the whole control room (core, ring of desks, back walls) fits at 1×.
    const base = Math.min(size.height / 36, size.width / 52) * viewOf(useWorld.getState().space).zoom;
    // Control modes frame their machine: look at the focus point and zoom in (scroll still works on top).
    const focus = stage.focus;
    const wantZoom = focus ? Math.max(zoomGoal.current, focus.zoom) : zoomGoal.current;
    zoom.current += (wantZoom - zoom.current) * (1 - Math.exp(-dt * (focus ? 4 : 10)));

    const goal = focus
      ? new THREE.Vector3(focus.x, 0, focus.z)
      : new THREE.Vector3(player.pos.x, 0, player.pos.z);
    if (layout) {
      const f = layout.frame;
      goal.x = THREE.MathUtils.clamp(goal.x, f.minX, f.maxX);
      goal.z = THREE.MathUtils.clamp(goal.z, f.minZ, f.maxZ);
    }
    // Snap on space change (the fade hides it), ease otherwise.
    if (snapped.current !== stage.version) {
      target.current.copy(goal);
      snapped.current = stage.version;
    } else {
      target.current.lerp(goal, 1 - Math.exp(-dt * (focus ? 3.5 : 5)));
    }

    camera.position.copy(target.current).add(OFFSET);
    camera.lookAt(target.current);
    const z = base * zoom.current;
    if (Math.abs(camera.zoom - z) > 1e-4) {
      camera.zoom = z;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { promptVerb } from '../game/interactions';
import { logistics } from '../game/runtime';
import { useLogistics } from '../state/logistics';
import { useWorld } from '../state/world';

/**
 * World-space "E · TALK" prompt over the nearest interactable. Re-renders only
 * when that changes; a prompt on the cart being pushed follows it every frame.
 */
export function InteractPrompt() {
  const near = useWorld((s) => s.near);
  useLogistics((s) => s.cart.bay); // verbs change with where the cart is docked
  const pushing = useLogistics((s) => s.cart.attached);
  const group = useRef<THREE.Group>(null);
  const follow = near?.id === 'cart' && pushing;

  useFrame(() => {
    const g = group.current;
    if (!g || !near) return;
    if (follow) g.position.set(logistics.state.cart.x, near.promptHeight ?? 1.8, logistics.state.cart.z);
    else g.position.set(near.position.x, near.promptHeight ?? 1.8, near.position.z);
  });

  if (!near) return null;
  return (
    <group ref={group}>
      <Html zIndexRange={[20, 0]} pointerEvents="none">
        <div className="prompt">
          <span className="prompt__key">E</span>
          <span className="prompt__text">
            <b>{promptVerb(near)}</b>
            <small>
              {near.label}
              {near.detail ? ` · ${near.detail}` : ''}
            </small>
          </span>
        </div>
      </Html>
    </group>
  );
}

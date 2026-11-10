import { Html } from '@react-three/drei';
import { promptVerb } from '../game/interactions';
import { useWorld } from '../state/world';

/** World-space "E · TALK" prompt over the nearest interactable. Re-renders only when that changes. */
export function InteractPrompt() {
  const near = useWorld((s) => s.near);
  useWorld((s) => s.carrying); // verb can change with what you carry
  if (!near) return null;
  return (
    <Html
      position={[near.position.x, near.promptHeight ?? 1.8, near.position.z]}
      zIndexRange={[20, 0]}
      pointerEvents="none"
    >
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
  );
}

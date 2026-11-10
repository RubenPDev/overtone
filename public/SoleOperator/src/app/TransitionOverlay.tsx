import { useWorld } from '../state/world';

/** Full-screen fade used when moving between rooms and corridors. */
export function TransitionOverlay() {
  const t = useWorld((s) => s.transition);
  return (
    <div className={`transition is-${t.phase}`} aria-hidden={t.phase === 'idle'}>
      <div className="transition__title">{t.title}</div>
      <div className="transition__sub">{t.subtitle}</div>
    </div>
  );
}

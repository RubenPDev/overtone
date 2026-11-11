import { deleteSaves, defaultStorage } from '../core/save';
import { useApp, type AudioSettings, type Quality } from '../state/app';

const SLIDERS: { key: keyof AudioSettings; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'Effects' },
  { key: 'ambience', label: 'Ambience' },
];

export function SettingsPanel() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const close = useApp((s) => s.closeSettings);
  const screen = useApp((s) => s.screen);

  return (
    <div className="overlay">
      <div className="panel">
        <div className="panel__eyebrow">Settings</div>
        <h2 className="panel__title">Graphics</h2>
        <div className="field">
          <span>Quality</span>
          <div className="seg">
            {(['high', 'low'] as Quality[]).map((q) => (
              <button
                key={q}
                className={settings.quality === q ? 'is-on' : ''}
                onClick={() => update({ quality: q })}
              >
                {q === 'high' ? 'High' : 'Low'}
              </button>
            ))}
          </div>
        </div>
        <p className="panel__note">
          High: bloom, soft shadows, anti-aliasing and full resolution. Low turns those off for older laptops
          and phones.
        </p>
        <h2 className="panel__title">Sound</h2>
        {SLIDERS.map(({ key, label }) => (
          <label key={key} className="field slider">
            <span>{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audio[key]}
              onChange={(e) => update({ audio: { ...settings.audio, [key]: Number(e.target.value) } })}
            />
            <b>{Math.round(settings.audio[key] * 100)}</b>
          </label>
        ))}
        {screen === 'title' && (
          <>
            <h2 className="panel__title">Saves</h2>
            <button
              className="menu__item is-danger"
              onClick={() => {
                if (confirm('Delete all Sole Operator saves on this device?')) deleteSaves(defaultStorage());
              }}
            >
              Delete saves
            </button>
          </>
        )}
        <button className="menu__item is-primary" onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}

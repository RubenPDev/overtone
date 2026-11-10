import { deleteSaves, defaultStorage } from '../core/save';
import { useApp, type Quality } from '../state/app';

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

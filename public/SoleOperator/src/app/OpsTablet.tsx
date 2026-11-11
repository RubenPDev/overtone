import { useState } from 'react';
import { buyItem, closeTablet, poolFree, sendNow, shipSpent, spentInPool } from '../game/ops';
import {
  MARKET,
  RECIPES,
  SELL_PRICE,
  STOCK_LABEL,
  UPGRADES,
  clearanceCost,
  type Contract,
  type StockId,
  type UpgradeDef,
} from '../sim';
import { useHud, type HudSim } from '../state/hud';
import { useLogistics } from '../state/logistics';
import './ops.css';

type Tab = 'contracts' | 'upgrades' | 'tools' | 'market' | 'clearance';
const TABS: { id: Tab; label: string }[] = [
  { id: 'contracts', label: 'Contracts' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'tools', label: 'Tools' },
  { id: 'market', label: 'Market' },
  { id: 'clearance', label: 'Clearance' },
];

const cr = (n: number) => `${Math.round(n).toLocaleString('en-US')}`;

function duration(s: number) {
  if (s <= 0) return 'now';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
}

/** The operator's handheld: contracts, upgrades, tools, market and clearance. */
export function OpsTablet() {
  const sim = useHud((s) => s.sim);
  const [tab, setTab] = useState<Tab>('contracts');
  if (!sim) return null;
  const { econ, accel } = sim;
  const offers = econ.contracts.filter((c) => c.status === 'offered').length;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && closeTablet()}>
      <div className="ops" role="dialog" aria-label="Ops tablet">
        <header className="ops__head">
          <div>
            <div className="panel__eyebrow">Ops tablet · Unit 1</div>
            <h2 className="ops__title">Plant operations</h2>
          </div>
          <dl className="ops__stats">
            <div>
              <dt>Credits</dt>
              <dd className={econ.credits < 0 ? 'is-neg' : ''}>
                {cr(econ.credits)} <small>CR</small>
              </dd>
            </div>
            <div>
              <dt>Research</dt>
              <dd>{cr(accel.stock.research)}</dd>
            </div>
            <div>
              <dt>Clearance</dt>
              <dd>L{accel.clearance}</dd>
            </div>
            <div>
              <dt>Grid price</dt>
              <dd>
                {econ.price.toFixed(2)} <small>CR/MWh</small>
              </dd>
            </div>
            <div>
              <dt>Selling</dt>
              <dd className={sim.netOutput < 0 ? 'is-neg' : ''}>
                {cr(sim.netOutput * econ.price)} <small>CR/h</small>
              </dd>
            </div>
          </dl>
          <button className="ops__close" onClick={closeTablet} aria-label="Close">
            <kbd>T</kbd> Close
          </button>
        </header>
        <nav className="ops__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'is-on' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'contracts' && offers > 0 && <i className="ops__badge">{offers}</i>}
            </button>
          ))}
        </nav>
        <div className="ops__body">
          {tab === 'contracts' && <Contracts sim={sim} />}
          {tab === 'upgrades' && <Upgrades sim={sim} tools={false} />}
          {tab === 'tools' && <Upgrades sim={sim} tools />}
          {tab === 'market' && <Market sim={sim} />}
          {tab === 'clearance' && <Clearance sim={sim} />}
        </div>
      </div>
    </div>
  );
}

// --- Contracts --------------------------------------------------------------------

function ContractCard({ c, sim }: { c: Contract; sim: HudSim }) {
  const active = c.status === 'active';
  const have = c.stock ? sim.accel.stock[c.stock] : 0;
  const fill = c.kind === 'grid' ? c.progress / c.amount : Math.min(1, have / c.amount);
  const left = active ? c.deadline - sim.time : c.expires - sim.time;
  return (
    <article className={`card contract is-${c.kind}${active ? ' is-active' : ''}`}>
      <div className="card__eyebrow">
        {c.kind === 'grid' ? 'Grid dispatch' : 'Delivery'} · {c.client}
      </div>
      <h3 className="card__title">{c.title}</h3>
      {active ? (
        <>
          <div className="progress">
            <i style={{ width: `${Math.round(fill * 100)}%` }} />
          </div>
          <div className="card__meta">
            {c.kind === 'grid'
              ? `${duration(c.progress)} of ${duration(c.amount)} held · now ${cr(sim.netOutput)} MWe`
              : `In stores: ${cr(have)} / ${cr(c.amount)} · delivered automatically`}
          </div>
        </>
      ) : (
        <div className="card__meta">
          {c.kind === 'grid'
            ? `Time allowed: ${duration(c.window)}`
            : `In stores now: ${cr(have)} · time allowed: ${duration(c.window)}`}
        </div>
      )}
      <footer className="card__foot">
        <span className="price">
          +{cr(c.reward)} <small>CR</small>
        </span>
        <span className={`card__clock${left < 3600 ? ' is-late' : ''}`}>
          {active ? 'Due in' : 'Offer ends in'} {duration(left)}
        </span>
        {!active && (
          <span className="card__actions">
            <button className="btn" onClick={() => sendNow({ type: 'declineContract', id: c.id })}>
              Decline
            </button>
            <button className="btn is-primary" onClick={() => sendNow({ type: 'acceptContract', id: c.id })}>
              Accept
            </button>
          </span>
        )}
      </footer>
    </article>
  );
}

function Contracts({ sim }: { sim: HudSim }) {
  const active = sim.econ.contracts.filter((c) => c.status === 'active');
  const offered = sim.econ.contracts.filter((c) => c.status === 'offered');
  const recent = sim.econ.contracts.filter((c) => c.status === 'done' || c.status === 'failed').slice(-4);
  return (
    <div className="ops__cols">
      <section>
        <h4 className="ops__h">Active · {active.length}/3</h4>
        {active.length ? (
          active.map((c) => <ContractCard key={c.id} c={c} sim={sim} />)
        ) : (
          <p className="ops__empty">
            No contracts running. Accept an offer to earn more than the market pays.
          </p>
        )}
        {recent.length > 0 && (
          <>
            <h4 className="ops__h">Recent</h4>
            <ul className="ops__log">
              {recent.map((c) => (
                <li key={c.id} className={`is-${c.status}`}>
                  <b>{c.status === 'done' ? `+${cr(c.reward)}` : 'Failed'}</b> {c.title}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section>
        <h4 className="ops__h">Offers</h4>
        {offered.length ? (
          offered.map((c) => <ContractCard key={c.id} c={c} sim={sim} />)
        ) : (
          <p className="ops__empty">No offers right now. New ones come in every few hours.</p>
        )}
        <p className="ops__note">Completed contracts so far: {sim.econ.completed}</p>
      </section>
    </div>
  );
}

// --- Upgrades and tools ----------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  reactor: 'Reactor',
  turbine: 'Turbine hall',
  ring: 'Accelerator ring',
  water: 'Water containers',
  tools: 'Tools',
};

function UpgradeCard({ u, sim }: { u: UpgradeDef; sim: HudSim }) {
  const lvl = sim.econ.upgrades[u.id] ?? 0;
  const next = u.levels[lvl];
  const locked = next && next.clearance > sim.accel.clearance;
  const short = next && (sim.econ.credits < next.cost || sim.accel.stock.research < (next.research ?? 0));
  return (
    <article className={`card upgrade${!next ? ' is-max' : ''}${locked ? ' is-locked' : ''}`}>
      <div className="card__eyebrow">
        {CATEGORY_LABEL[u.category]}
        {u.levels.length > 1 && (
          <span className="pips">
            {u.levels.map((_, i) => (
              <i key={i} className={i < lvl ? 'on' : ''} />
            ))}
          </span>
        )}
      </div>
      <h3 className="card__title">{u.name}</h3>
      <p className="card__blurb">{u.blurb}</p>
      <div className="card__effect">{next ? u.effect[lvl] : (u.effect[lvl - 1] ?? 'Installed')}</div>
      <footer className="card__foot">
        {next ? (
          <>
            <span className="price">
              {cr(next.cost)} <small>CR</small>
              {next.research ? (
                <>
                  {' '}
                  · {cr(next.research)} <small>data</small>
                </>
              ) : null}
            </span>
            <button
              className="btn is-primary"
              disabled={!!locked || !!short}
              title={locked ? `Needs clearance L${next.clearance}` : short ? 'Not enough funds' : undefined}
              onClick={() => sendNow({ type: 'buyUpgrade', id: u.id })}
            >
              {locked ? `L${next.clearance}` : lvl ? 'Upgrade' : u.category === 'tools' ? 'Buy' : 'Install'}
            </button>
          </>
        ) : (
          <span className="card__owned">{u.category === 'tools' ? 'Owned' : 'Fully upgraded'}</span>
        )}
      </footer>
    </article>
  );
}

function Upgrades({ sim, tools }: { sim: HudSim; tools: boolean }) {
  const list = UPGRADES.filter((u) => (u.category === 'tools') === tools);
  return (
    <div className="ops__grid">
      {list.map((u) => (
        <UpgradeCard key={u.id} u={u} sim={sim} />
      ))}
    </div>
  );
}

// --- Market ------------------------------------------------------------------------

function Market({ sim }: { sim: HudSim }) {
  const stock = sim.accel.stock;
  const spent = useLogistics((s) => s.pool.filter((a) => a && a.burnup >= 0.5).length);
  const sellable = (Object.keys(SELL_PRICE) as StockId[]).filter(
    (k) => stock[k] > 0 || k === 'enriched-u' || k === 'mo99',
  );
  return (
    <div className="ops__cols">
      <section>
        <h4 className="ops__h">Sell products</h4>
        <table className="ops__table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Stores</th>
              <th>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sellable.map((k) => (
              <tr key={k}>
                <td>{STOCK_LABEL[k]}</td>
                <td>{cr(stock[k])}</td>
                <td>{cr(SELL_PRICE[k]!)}</td>
                <td className="ops__row-actions">
                  <button
                    className="btn"
                    disabled={stock[k] < 1}
                    onClick={() => sendNow({ type: 'sell', stock: k, amount: 1 })}
                  >
                    Sell 1
                  </button>
                  <button
                    className="btn"
                    disabled={stock[k] < 1}
                    onClick={() => sendNow({ type: 'sell', stock: k, amount: stock[k] })}
                  >
                    All
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ops__note">
          Contracts usually pay more than the market. Fabricating fuel needs 40 kg of enriched uranium.
        </p>
        <h4 className="ops__h">Spent fuel</h4>
        <div className="card">
          <div className="card__title">Ship spent assemblies</div>
          <p className="card__blurb">
            {spent} spent in the pool rack · {poolFree()} free slots. Shipped assemblies become transmutation
            feed in the ring stores.
          </p>
          <footer className="card__foot">
            <span className="price">Free</span>
            <button className="btn is-primary" disabled={!spentInPool()} onClick={shipSpent}>
              Ship {spent || ''}
            </button>
          </footer>
        </div>
      </section>
      <section>
        <h4 className="ops__h">Buy</h4>
        <div className="ops__list">
          {MARKET.map((m) => {
            const locked = m.clearance > sim.accel.clearance;
            const short =
              sim.econ.credits < m.cost || (m.consumes ? stock[m.consumes.stock] < m.consumes.amount : false);
            return (
              <div key={m.id} className={`card is-row${locked ? ' is-locked' : ''}`}>
                <div>
                  <div className="card__title">{m.name}</div>
                  <p className="card__blurb">
                    {m.blurb}
                    {m.stock ? ` In stores: ${cr(stock[m.stock])}.` : ''}
                  </p>
                </div>
                <span className="price">
                  {cr(m.cost)} <small>CR</small>
                </span>
                <button className="btn is-primary" disabled={locked || short} onClick={() => buyItem(m.id)}>
                  {locked ? `L${m.clearance}` : 'Buy'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// --- Clearance -----------------------------------------------------------------------

function Clearance({ sim }: { sim: HudSim }) {
  const level = sim.accel.clearance;
  const cost = clearanceCost(level);
  const next = level + 1;
  const unlocks = [
    ...RECIPES.filter((r) => r.tier === next).map((r) => `Recipe · ${r.name}`),
    ...UPGRADES.flatMap((u) =>
      u.levels.map((l, i) =>
        l.clearance === next ? `${u.name}${u.levels.length > 1 ? ` (level ${i + 1})` : ''}` : null,
      ),
    ).filter((x): x is string => !!x),
    ...MARKET.filter((m) => m.clearance === next).map((m) => `Market · ${m.name}`),
  ];
  const canFile = sim.econ.credits >= cost.credits && sim.accel.stock.research >= cost.research;
  return (
    <div className="ops__cols">
      <section>
        <div className="clearance">
          <div className="clearance__level">
            L{level}
            <small>of 8</small>
          </div>
          <div className="clearance__pips">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} className={i < level ? 'on' : ''} />
            ))}
          </div>
        </div>
        <p className="ops__note">
          Research data comes from collider runs in the Detector Hall (ring sector 3). A review spends data
          and a filing fee; each level unlocks recipes, upgrades, supplies and better-paying contracts.
        </p>
      </section>
      <section>
        {level < 8 ? (
          <div className="card">
            <div className="card__eyebrow">Clearance review</div>
            <h3 className="card__title">
              L{level} → L{next}
            </h3>
            <ul className="ops__unlocks">
              {unlocks.length ? unlocks.map((u) => <li key={u}>{u}</li>) : <li>Higher-tier contracts</li>}
            </ul>
            <footer className="card__foot">
              <span className="price">
                {cr(cost.research)} <small>data</small> · {cr(cost.credits)} <small>CR</small>
              </span>
              <button
                className="btn is-primary"
                disabled={!canFile}
                onClick={() => sendNow({ type: 'clearanceReview' })}
              >
                File review
              </button>
            </footer>
            <div className="progress">
              <i style={{ width: `${Math.min(100, (sim.accel.stock.research / cost.research) * 100)}%` }} />
            </div>
            <div className="card__meta">
              Research {cr(sim.accel.stock.research)} / {cr(cost.research)}
            </div>
          </div>
        ) : (
          <p className="ops__empty">Highest clearance. Every recipe and upgrade is open to you.</p>
        )}
      </section>
    </div>
  );
}

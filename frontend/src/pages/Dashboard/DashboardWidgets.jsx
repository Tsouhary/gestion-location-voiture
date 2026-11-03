import { Link } from 'react-router-dom';
import useCountUp from '../../hooks/useCountUp.js';
import { Badge } from '../../components/ui.jsx';
import { Icon } from '../../components/Icons.jsx';
import {
  ALERT_LABEL, RESERVATION_STATUS, VEHICLE_STATUS, formatDate, formatDateTime, formatMoney, vehicleLabel,
} from '../../utils/format.js';

/* ------------------------------------------------------------------ Bannière d'accueil */

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function Hero({ firstName, summary, figure, figureLabel, pending, staff }) {
  const shown = useCountUp(figure);
  const today = capitalize(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true"><span /><span /><span /></div>
      <div className="hero-text">
        <p className="hero-date">{today}</p>
        <h1>{new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'}, {firstName}</h1>
        <p className="hero-sub">{summary}</p>
        <div className="hero-actions">
          <Link className="btn btn-light" to="/reservations?new=1"><Icon name="plus" size={16} />Nouvelle réservation</Link>
          {staff && pending > 0 && (
            <Link className="btn btn-outline-light" to="/reservations?status=pending">Traiter les demandes ({pending})</Link>
          )}
        </div>
      </div>
      <div className="hero-figure">
        <div className="hero-number">{shown}</div>
        <div className="hero-figure-label">{figureLabel}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Circuit d'une réservation */

const STEPS = [
  { key: 'pending', tone: 'amber', hint: 'à valider' },
  { key: 'validated', tone: 'green', hint: 'confirmées' },
  { key: 'in_progress', tone: 'blue', hint: 'véhicule parti' },
  { key: 'completed', tone: 'gray', hint: 'retournées' },
];

function Step({ step, value, last }) {
  const shown = useCountUp(value);
  const attention = step.key === 'pending' && value > 0;
  return (
    <Link
      to={`/reservations?status=${step.key}`}
      className={`step step-${step.tone}${attention ? ' attention' : ''}${last ? ' last' : ''}`}
    >
      <span className="step-num">{shown}</span>
      <span className="step-label">{RESERVATION_STATUS[step.key]}</span>
      <span className="step-hint">{step.hint}</span>
    </Link>
  );
}

export function Pipeline({ reservations }) {
  const others = reservations.rejected + reservations.cancelled;
  return (
    <section>
      <div className="section-head">
        <h2>Circuit des réservations</h2>
        {others > 0 && <span className="muted">dont {reservations.rejected} refusée(s) et {reservations.cancelled} annulée(s), hors circuit</span>}
      </div>
      <div className="pipeline stagger">
        {STEPS.map((s, i) => <Step key={s.key} step={s} value={reservations[s.key]} last={i === STEPS.length - 1} />)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ État du parc (barre empilée + légende chiffrée) */

const FLEET_ORDER = ['available', 'reserved', 'in_mission', 'maintenance', 'out_of_service'];

export function FleetCard({ vehicles }) {
  const total = vehicles.total;
  const share = (n) => (total ? Math.round((n / total) * 100) : 0);
  const shown = FLEET_ORDER.filter((s) => vehicles[s] > 0);

  return (
    <div className="card dash-card">
      <header className="card-head">
        <h2>État du parc</h2>
        <Link to="/vehicles">{total} véhicule{total > 1 ? 's' : ''} →</Link>
      </header>

      {total === 0 ? (
        <p className="muted">Aucun véhicule enregistré.</p>
      ) : (
        <>
          <div className="fleet-bar" role="img" aria-label={`Répartition des ${total} véhicules par statut`}>
            {shown.map((s, i) => (
              <span
                key={s}
                className="seg"
                tabIndex={0}
                style={{ flexGrow: vehicles[s], '--c': `var(--st-${s})`, animationDelay: `${i * 90}ms` }}
              >
                <span className="tip">{VEHICLE_STATUS[s]} · {vehicles[s]} ({share(vehicles[s])} %)</span>
              </span>
            ))}
          </div>

          <ul className="legend">
            {FLEET_ORDER.map((s) => (
              <li key={s} className={vehicles[s] === 0 ? 'zero' : undefined}>
                <span className="sw" style={{ '--c': `var(--st-${s})` }} />
                <Link to={`/vehicles?status=${s}`}>{VEHICLE_STATUS[s]}</Link>
                <strong>{vehicles[s]}</strong>
                <span className="muted">{share(vehicles[s])} %</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Facturation (jauge) */

export function BillingCard({ invoices, staff }) {
  const active = (invoices ?? []).filter((i) => i.status !== 'cancelled');
  const billed = active.reduce((s, i) => s + i.total, 0);
  const collected = active.reduce((s, i) => s + i.paid, 0);
  const due = billed - collected;
  const pct = billed ? Math.round((collected / billed) * 100) : 0;
  const toPay = active.filter((i) => i.balance > 0).length;
  const shownPct = useCountUp(pct);

  return (
    <div className="card dash-card">
      <header className="card-head">
        <h2>{staff ? 'Facturation' : 'Mes factures'}</h2>
        <Link to="/invoices">Détails →</Link>
      </header>

      {active.length === 0 ? (
        <p className="muted">Aucune facture pour le moment.</p>
      ) : (
        <>
          <div className="bill-amount">{formatMoney(collected)}</div>
          <div className="muted">encaissé sur {formatMoney(billed)} facturés</div>
          <div className="meter" role="img" aria-label={`${pct} % encaissé`}><span className="meter-fill" style={{ width: `${pct}%` }} /></div>
          <div className="meter-legend"><span>{shownPct} % encaissé</span><span>Reste : <strong>{formatMoney(due)}</strong></span></div>
          <div className="bill-foot">
            <Icon name="receipt" size={16} />
            {toPay > 0 ? <>{toPay} facture{toPay > 1 ? 's' : ''} à régler</> : 'Toutes les factures sont réglées'}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Agenda des prochaines réservations */

const monthShort = (s) => new Date(`${s.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');

export function Agenda({ rows, showRequester }) {
  return (
    <div className="card dash-card">
      <header className="card-head">
        <h2>Prochaines réservations</h2>
        <Link to="/reservations">Tout voir →</Link>
      </header>
      {rows.length === 0 ? (
        <div className="empty-state compact"><Icon name="calendar" size={30} /><p>Aucune réservation à venir.</p></div>
      ) : (
        <ul className="agenda stagger">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="date-tile"><span className="d">{r.start_at.slice(8, 10)}</span><span className="m">{monthShort(r.start_at)}</span></div>
              <div className="agenda-main">
                <strong>{r.destination}</strong>
                <span className="muted">{[showRequester && r.requester_name, r.registration && vehicleLabel(r)].filter(Boolean).join(' · ') || '—'}</span>
                <span className="agenda-time">{r.start_at.slice(11, 16)} → {formatDateTime(r.end_at)}</span>
              </div>
              <Badge status={r.status} label={RESERVATION_STATUS[r.status]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Alertes */

const dueLabel = (a) => {
  if (a.type === 'maintenance_due') return a.severity === 'expired' ? 'en retard depuis le' : 'à faire avant le';
  return a.severity === 'expired' ? 'expiré le' : 'expire le';
};

export function AlertsCard({ alerts }) {
  const expired = alerts.filter((a) => a.severity === 'expired').length;
  const soon = alerts.length - expired;

  return (
    <div className="card dash-card">
      <header className="card-head">
        <h2>Alertes</h2>
        <span className="chips">
          {expired > 0 && <span className="chip chip-red">{expired} expiré{expired > 1 ? 's' : ''}</span>}
          {soon > 0 && <span className="chip chip-amber">{soon} à venir</span>}
        </span>
      </header>
      {alerts.length === 0 ? (
        <div className="empty-state compact"><Icon name="check" size={30} /><p>Tout est à jour.</p></div>
      ) : (
        <ul className="alert-list compact stagger">
          {alerts.map((a, i) => (
            <li key={`${a.type}-${a.id}-${i}`} className={a.severity === 'expired' ? 'is-expired' : 'is-soon'}>
              <span className="alert-icon"><Icon name={a.severity === 'expired' ? 'alert' : 'clock'} size={16} /></span>
              <div>
                <strong>{ALERT_LABEL[a.type]}</strong>
                <div className="muted">
                  {a.label ?? `${a.brand} ${a.model} (${a.registration})`} · {dueLabel(a)} {formatDate(a.due_date)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

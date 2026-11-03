import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import { Badge, DataState, PageHeader } from '../../components/ui.jsx';
import { Icon } from '../../components/Icons.jsx';
import {
  FUEL, GEARBOX, MAINTENANCE_TYPE, RESERVATION_STATUS, VEHICLE_STATUS,
  formatDate, formatKm, formatMoney, isStaff,
} from '../../utils/format.js';

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Expiry({ label, value }) {
  const expired = value && value < today();
  return (
    <div>
      <dt>{label}</dt>
      <dd className={expired ? 'text-danger' : undefined}>{formatDate(value)}{expired && ' (expiré)'}</dd>
    </div>
  );
}

function History({ id }) {
  const { data, loading, error } = useFetch(`/vehicles/${id}/history`);
  return (
    <section>
      <h2>Historique</h2>
      <DataState loading={loading} error={error} empty={data?.length === 0}>
        <ul className="timeline">
          {data?.map((e) => (
            <li key={`${e.kind}-${e.id}`}>
              <time>{formatDate(e.at)}</time>
              {e.kind === 'reservation' ? (
                <span>
                  Réservation — {e.destination} ({e.requester}){' '}
                  <Badge status={e.status} label={RESERVATION_STATUS[e.status]} />
                  {e.mileage_end != null && <small className="muted"> · {formatKm(e.mileage_end - e.mileage_start)} parcourus</small>}
                </span>
              ) : (
                <span>
                  Entretien — {MAINTENANCE_TYPE[e.type]}{e.garage && ` (${e.garage})`}
                  <small className="muted"> · {formatMoney(e.cost)}</small>
                </span>
              )}
            </li>
          ))}
        </ul>
      </DataState>
    </section>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: v, loading, error } = useFetch(`/vehicles/${id}`);

  return (
    <>
      <PageHeader title={v ? `${v.brand} ${v.model}` : 'Véhicule'}>
        <Link className="btn btn-ghost" to="/vehicles"><Icon name="arrowLeft" size={16} />Retour</Link>
      </PageHeader>
      <DataState loading={loading} error={error}>
        {v && (
          <>
            <section className="card">
              <dl className="details">
                <div><dt>Immatriculation</dt><dd>{v.registration}</dd></div>
                <div><dt>Statut</dt><dd><Badge status={v.display_status} label={VEHICLE_STATUS[v.display_status]} /></dd></div>
                <div><dt>Catégorie</dt><dd>{v.category_name ?? '—'}</dd></div>
                <div><dt>Année / couleur</dt><dd>{v.year ?? '—'} · {v.color ?? '—'}</dd></div>
                <div><dt>Carburant / boîte</dt><dd>{FUEL[v.fuel_type]} · {GEARBOX[v.transmission]}</dd></div>
                <div><dt>Places</dt><dd>{v.seats}</dd></div>
                <div><dt>Tarif par jour</dt><dd>{formatMoney(v.daily_rate)}</dd></div>
                <div><dt>Kilométrage</dt><dd>{formatKm(v.mileage)}</dd></div>
                <div><dt>Mise en circulation</dt><dd>{formatDate(v.first_registration_date)}</dd></div>
                <div><dt>Assurance</dt><dd>{v.insurance_company ?? '—'}</dd></div>
                <Expiry label="Expiration assurance" value={v.insurance_expiry} />
                <Expiry label="Expiration contrôle technique" value={v.technical_inspection_expiry} />
              </dl>
              {v.description && <p>{v.description}</p>}
            </section>
            {isStaff(user) && <History id={id} />}
          </>
        )}
      </DataState>
    </>
  );
}

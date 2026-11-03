import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import { DataState } from '../../components/ui.jsx';
import { isStaff } from '../../utils/format.js';
import { Agenda, AlertsCard, BillingCard, FleetCard, Hero, Pipeline } from './DashboardWidgets.jsx';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function staffSummary(data) {
  const expired = data.alerts.filter((a) => a.severity === 'expired').length;
  const soon = data.alerts.length - expired;
  const parts = [];
  if (data.reservations.pending) parts.push(`${plural(data.reservations.pending, 'demande', 'demandes')} en attente de validation`);
  if (expired) parts.push(`${plural(expired, 'élément expiré', 'éléments expirés')}`);
  if (soon) parts.push(`${plural(soon, 'échéance', 'échéances')} à venir`);
  return parts.length ? `À traiter : ${parts.join(' · ')}.` : "Tout est à jour, rien ne demande votre attention.";
}

export default function Dashboard() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const { data, loading, error } = useFetch('/dashboard');
  const invoices = useFetch(user.role === 'driver' ? null : '/invoices'); // le conducteur n'a pas accès à la facturation

  return (
    <DataState loading={loading} error={error}>
      {data && (
        staff ? (
          <div className="dash">
            <Hero
              firstName={user.first_name}
              summary={staffSummary(data)}
              figure={data.vehicles.available}
              figureLabel={`véhicule${data.vehicles.available > 1 ? 's' : ''} disponible${data.vehicles.available > 1 ? 's' : ''} sur ${data.vehicles.total}`}
              pending={data.reservations.pending}
              staff
            />
            <Pipeline reservations={data.reservations} />
            <div className="dash-grid dash-grid-a">
              <FleetCard vehicles={data.vehicles} />
              <BillingCard invoices={invoices.data} staff />
            </div>
            <div className="dash-grid dash-grid-b">
              <Agenda rows={data.upcoming} showRequester />
              <AlertsCard alerts={data.alerts} />
            </div>
          </div>
        ) : (
          <div className="dash">
            <Hero
              firstName={user.first_name}
              summary={
                data.reservations.pending
                  ? `${plural(data.reservations.pending, 'demande', 'demandes')} en attente de validation.`
                  : data.upcoming.length ? `${plural(data.upcoming.length, 'réservation', 'réservations')} à venir.` : "Aucune réservation à venir : besoin d'un véhicule ?"
              }
              figure={data.upcoming.length}
              figureLabel={`réservation${data.upcoming.length > 1 ? 's' : ''} à venir`}
              pending={0}
            />
            <Pipeline reservations={data.reservations} />
            <div className="dash-grid dash-grid-b">
              <Agenda rows={data.upcoming} showRequester={false} />
              {user.role !== 'driver' && <BillingCard invoices={invoices.data} staff={false} />}
            </div>
          </div>
        )
      )}
    </DataState>
  );
}

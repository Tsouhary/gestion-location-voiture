import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import { Alert, Field, Modal } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { formatDateTime, formatKm } from '../../utils/format.js';

/** Envoi d'une action sur une réservation, avec gestion d'erreur commune. */
function useAction(onDone) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return { error, busy, run };
}

const Summary = ({ r }) => (
  <p className="muted">
    #{r.id} · {r.requester_name} · {r.destination}<br />
    {formatDateTime(r.start_at)} → {formatDateTime(r.end_at)} · {r.passengers} passager(s)
  </p>
);

/** Validation : le gestionnaire choisit le véhicule et, si besoin, le conducteur (parmi les libres). */
export function AssignModal({ reservation: r, onClose, onDone }) {
  const [vehicleId, setVehicleId] = useState(r.vehicle_id ?? '');
  const [driverId, setDriverId] = useState(r.driver_id ?? '');
  const { error, busy, run } = useAction(onDone);

  const period = { start_at: r.start_at, end_at: r.end_at };
  const vehicles = useFetch('/vehicles/available', { ...period, seats: r.passengers });
  const drivers = useFetch('/drivers/available', period);

  const submit = (e) => {
    e.preventDefault();
    run(() => api.put(`/reservations/${r.id}/validate`, { vehicle_id: vehicleId, driver_id: driverId || null }));
  };

  return (
    <Modal title="Valider et affecter" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <div className="field-wide"><Summary r={r} /></div>
        <Alert>{error || vehicles.error || drivers.error}</Alert>
        <Field label="Véhicule *" wide>
          <Select required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">— Choisir —</option>
            {vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.registration} ({v.seats} places)</option>)}
          </Select>
          {vehicles.data?.length === 0 && <small className="text-danger">Aucun véhicule libre sur cette période.</small>}
        </Field>
        <Field label={r.driver_requested ? 'Conducteur * (demandé)' : 'Conducteur (optionnel)'} wide>
          <Select required={Boolean(r.driver_requested)} value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">— Aucun —</option>
            {drivers.data?.map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}
          </Select>
        </Field>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>Confirmer l'affectation</button>
        </div>
      </form>
    </Modal>
  );
}

export function RejectModal({ reservation: r, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const { error, busy, run } = useAction(onDone);

  return (
    <Modal title="Refuser la demande" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/reservations/${r.id}/reject`, { reason })); }}
      >
        <div className="field-wide"><Summary r={r} /></div>
        <Alert>{error}</Alert>
        <Field label="Motif du refus *" wide>
          <input required maxLength={255} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-danger" disabled={busy}>Refuser</button>
        </div>
      </form>
    </Modal>
  );
}

/** Retour du véhicule : saisie du kilométrage final. */
export function CompleteModal({ reservation: r, onClose, onDone }) {
  const [km, setKm] = useState(r.mileage_start ?? 0);
  const { error, busy, run } = useAction(onDone);

  return (
    <Modal title="Terminer la mission" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => { e.preventDefault(); run(() => api.put(`/reservations/${r.id}/complete`, { mileage_end: km })); }}
      >
        <div className="field-wide"><Summary r={r} /></div>
        <Alert>{error}</Alert>
        <Field label={`Kilométrage au retour (départ : ${formatKm(r.mileage_start)})`} wide>
          <input type="number" required min={r.mileage_start ?? 0} autoFocus value={km} onChange={(e) => setKm(e.target.value)} />
        </Field>
        {Number(km) >= (r.mileage_start ?? 0) && (
          <p className="field-wide muted">Distance parcourue : <strong>{formatKm(Number(km) - (r.mileage_start ?? 0))}</strong></p>
        )}
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>Terminer</button>
        </div>
      </form>
    </Modal>
  );
}

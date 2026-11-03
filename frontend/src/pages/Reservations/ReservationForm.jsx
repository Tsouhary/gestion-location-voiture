import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useForm from '../../hooks/useForm.js';
import { Alert, Field, Modal } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { toInputDateTime } from '../../utils/format.js';

const EMPTY = { start_at: '', end_at: '', destination: '', purpose: '', passengers: 1, vehicle_id: '', driver_requested: false };

export default function ReservationForm({ reservation, onClose, onSaved }) {
  const { values, setValues, bind, bindCheck } = useForm(
    reservation
      ? {
          start_at: toInputDateTime(reservation.start_at),
          end_at: toInputDateTime(reservation.end_at),
          destination: reservation.destination,
          purpose: reservation.purpose,
          passengers: reservation.passengers,
          vehicle_id: reservation.vehicle_id ?? '',
          driver_requested: Boolean(reservation.driver_requested),
        }
      : EMPTY,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Les véhicules proposés sont ceux réellement libres sur la période choisie.
  const periodOk = values.start_at && values.end_at && values.end_at > values.start_at;
  const available = useFetch(periodOk ? '/vehicles/available' : null, {
    start_at: values.start_at,
    end_at: values.end_at,
    seats: values.passengers || 1,
  });
  const options = available.data ?? [];

  // Si la période ou le nombre de passagers change et que le véhicule choisi n'est plus proposé, on le désélectionne.
  useEffect(() => {
    if (available.data && values.vehicle_id && !available.data.some((v) => String(v.id) === String(values.vehicle_id))) {
      setValues((prev) => ({ ...prev, vehicle_id: '' }));
    }
  }, [available.data, values.vehicle_id, setValues]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (reservation) await api.put(`/reservations/${reservation.id}`, values);
      else await api.post('/reservations', values);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={reservation ? 'Modifier la demande' : 'Nouvelle réservation'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <Field label="Départ *"><input type="datetime-local" required {...bind('start_at')} /></Field>
        <Field label="Retour *"><input type="datetime-local" required min={values.start_at} {...bind('end_at')} /></Field>
        <Field label="Destination *"><input required maxLength={150} {...bind('destination')} /></Field>
        <Field label="Nombre de passagers"><input type="number" min="1" max="100" {...bind('passengers')} /></Field>
        <Field label="Motif du déplacement *" wide><input required maxLength={255} {...bind('purpose')} /></Field>
        <Field label="Véhicule souhaité" wide>
          <Select disabled={!periodOk} {...bind('vehicle_id')}>
            <option value="">{periodOk ? '— Laisser le gestionnaire choisir —' : "Renseignez d'abord les dates"}</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.registration} ({v.seats} places)</option>
            ))}
          </Select>
          {periodOk && !available.loading && options.length === 0 && (
            <small className="text-danger">Aucun véhicule disponible sur cette période pour ce nombre de passagers.</small>
          )}
        </Field>
        <label className="field-wide check">
          <input type="checkbox" {...bindCheck('driver_requested')} /> Je souhaite un conducteur
        </label>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>{reservation ? 'Enregistrer' : 'Envoyer la demande'}</button>
        </div>
      </form>
    </Modal>
  );
}

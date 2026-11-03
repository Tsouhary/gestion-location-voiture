import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useDebounced from '../../hooks/useDebounced.js';
import useForm from '../../hooks/useForm.js';
import { Alert, Badge, DataState, Field, Modal, PageHeader, AddButton, confirmDelete } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { Icon } from '../../components/Icons.jsx';
import { DRIVER_STATUS, RESERVATION_STATUS, formatDate, formatDateTime, formatKm, vehicleLabel } from '../../utils/format.js';

const EMPTY = {
  first_name: '', last_name: '', phone: '', email: '', address: '', license_number: '',
  license_category: '', license_expiry: '', status: 'available', hire_date: '',
};

function DriverForm({ driver, onClose, onSaved }) {
  const { values, bind } = useForm(driver ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, driver[k] ?? ''])) : EMPTY);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (driver) await api.put(`/drivers/${driver.id}`, values);
      else await api.post('/drivers', values);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal title={driver ? 'Modifier le conducteur' : 'Nouveau conducteur'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <Field label="Prénom *"><input required {...bind('first_name')} /></Field>
        <Field label="Nom *"><input required {...bind('last_name')} /></Field>
        <Field label="Téléphone"><input {...bind('phone')} /></Field>
        <Field label="Email"><input type="email" {...bind('email')} /></Field>
        <Field label="Adresse" wide><input {...bind('address')} /></Field>
        <Field label="N° de permis *"><input required {...bind('license_number')} /></Field>
        <Field label="Catégorie de permis"><input maxLength={10} {...bind('license_category')} /></Field>
        <Field label="Expiration du permis *"><input type="date" required {...bind('license_expiry')} /></Field>
        <Field label="Date d'embauche"><input type="date" {...bind('hire_date')} /></Field>
        <Field label="Statut">
          <Select {...bind('status')}>{Object.entries(DRIVER_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

function MissionsModal({ driver, onClose }) {
  const { data, loading, error } = useFetch(`/drivers/${driver.id}/missions`);
  return (
    <Modal title={`Missions — ${driver.first_name} ${driver.last_name}`} onClose={onClose} wide>
      <DataState loading={loading} error={error} empty={data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Départ</th><th>Destination</th><th>Véhicule</th><th>Distance</th><th>Statut</th></tr></thead>
            <tbody>
              {data?.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.start_at)}</td>
                  <td>{m.destination}</td>
                  <td>{vehicleLabel(m)}</td>
                  <td>{m.mileage_end != null ? formatKm(m.mileage_end - m.mileage_start) : '—'}</td>
                  <td><Badge status={m.status} label={RESERVATION_STATUS[m.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </Modal>
  );
}

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function Drivers() {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const drivers = useFetch('/drivers', debounced ? { q: debounced } : {});
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');

  const remove = async (d) => {
    if (!(await confirmDelete(`Supprimer le conducteur ${d.first_name} ${d.last_name} ?`))) return;
    setActionError('');
    try {
      await api.delete(`/drivers/${d.id}`);
      drivers.reload();
    } catch (err) {
      setActionError(`${errorMessage(err)}. Passez plutôt le conducteur « Indisponible ».`);
    }
  };

  return (
    <>
      <PageHeader title="Conducteurs">
        <AddButton onClick={() => setModal({ type: 'form' })}>Ajouter un conducteur</AddButton>
      </PageHeader>
      <div className="filters">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Nom, permis, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <Alert>{actionError}</Alert>
      <DataState loading={drivers.loading} error={drivers.error} empty={drivers.data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Téléphone</th><th>Permis</th><th>Expiration</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {drivers.data?.map((d) => (
                <tr key={d.id}>
                  <td>{d.first_name} {d.last_name}</td>
                  <td>{d.phone ?? '—'}</td>
                  <td>{d.license_number} {d.license_category && <small className="muted">({d.license_category})</small>}</td>
                  <td className={d.license_expiry < today() ? 'text-danger' : undefined}>{formatDate(d.license_expiry)}</td>
                  <td><Badge status={d.status} label={DRIVER_STATUS[d.status]} /></td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'missions', driver: d })}>Missions</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'form', driver: d })}>Modifier</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(d)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      {modal?.type === 'form' && (
        <DriverForm driver={modal.driver} onClose={() => setModal(null)} onSaved={() => { setModal(null); drivers.reload(); }} />
      )}
      {modal?.type === 'missions' && <MissionsModal driver={modal.driver} onClose={() => setModal(null)} />}
    </>
  );
}

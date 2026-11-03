import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useForm from '../../hooks/useForm.js';
import { Alert, DataState, Field, Modal, PageHeader, AddButton, confirmDelete } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { MAINTENANCE_TYPE, formatDate, formatKm, formatMoney } from '../../utils/format.js';

const EMPTY = {
  vehicle_id: '', type: 'vidange', maintenance_date: '', mileage: '', description: '', cost: '',
  garage: '', next_date: '', next_mileage: '', put_in_maintenance: false,
};

function MaintenanceForm({ record, vehicles, onClose, onSaved }) {
  const initial = record ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, record[k] ?? EMPTY[k]])) : EMPTY;
  const { values, bind, bindCheck } = useForm(initial);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      // "put_in_maintenance" n'existe qu'à la création (la mise à jour ne change pas le statut du véhicule).
      const { put_in_maintenance, ...rest } = values;
      if (record) await api.put(`/maintenance/${record.id}`, rest);
      else await api.post('/maintenance', values);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal title={record ? "Modifier l'entretien" : 'Nouvel entretien'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <Field label="Véhicule *">
          <Select required disabled={Boolean(record)} {...bind('vehicle_id')}>
            <option value="">— Choisir —</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.registration}</option>)}
          </Select>
        </Field>
        <Field label="Type *">
          <Select {...bind('type')}>{Object.entries(MAINTENANCE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label="Date *"><input type="date" required {...bind('maintenance_date')} /></Field>
        <Field label="Kilométrage"><input type="number" min="0" {...bind('mileage')} /></Field>
        <Field label="Coût (Ar)"><input type="number" min="0" step="1" {...bind('cost')} /></Field>
        <Field label="Garage"><input {...bind('garage')} /></Field>
        <Field label="Prochaine date"><input type="date" {...bind('next_date')} /></Field>
        <Field label="Prochain kilométrage"><input type="number" min="0" {...bind('next_mileage')} /></Field>
        <Field label="Description" wide><textarea rows="3" {...bind('description')} /></Field>
        {!record && (
          <label className="field-wide check">
            <input type="checkbox" {...bindCheck('put_in_maintenance')} />
            Placer le véhicule « En maintenance » (il ne sera plus réservable)
          </label>
        )}
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Maintenance() {
  const [filters, setFilters] = useState({ vehicle_id: '', type: '' });
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  const records = useFetch('/maintenance', params);
  const vehicles = useFetch('/vehicles');
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');

  const set = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));

  const remove = async (m) => {
    if (!(await confirmDelete('Supprimer cet entretien ?'))) return;
    setActionError('');
    try {
      await api.delete(`/maintenance/${m.id}`);
      records.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const total = records.data?.reduce((sum, m) => sum + Number(m.cost), 0) ?? 0;

  return (
    <>
      <PageHeader title="Entretiens">
        <AddButton onClick={() => setModal({})}>Enregistrer un entretien</AddButton>
      </PageHeader>
      <div className="filters">
        <Select value={filters.vehicle_id} onChange={set('vehicle_id')}>
          <option value="">Tous les véhicules</option>
          {vehicles.data?.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.registration}</option>)}
        </Select>
        <Select value={filters.type} onChange={set('type')}>
          <option value="">Tous les types</option>
          {Object.entries(MAINTENANCE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
      <Alert>{actionError}</Alert>
      <DataState loading={records.loading} error={records.error} empty={records.data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Véhicule</th><th>Type</th><th>Km</th><th>Coût</th><th>Garage</th><th>Prochain</th><th /></tr></thead>
            <tbody>
              {records.data?.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.maintenance_date)}</td>
                  <td>{m.brand} {m.model} <small className="muted">{m.registration}</small></td>
                  <td>{MAINTENANCE_TYPE[m.type]}</td>
                  <td>{formatKm(m.mileage)}</td>
                  <td>{formatMoney(m.cost)}</td>
                  <td>{m.garage ?? '—'}</td>
                  <td>{m.next_date ? formatDate(m.next_date) : '—'}{m.next_mileage != null && ` / ${formatKm(m.next_mileage)}`}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ record: m })}>Modifier</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(m)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan="4">Total affiché</td><td colSpan="4"><strong>{formatMoney(total)}</strong></td></tr></tfoot>
          </table>
        </div>
      </DataState>

      {modal && (
        <MaintenanceForm
          record={modal.record}
          vehicles={vehicles.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); records.reload(); vehicles.reload(); }}
        />
      )}
    </>
  );
}

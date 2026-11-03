import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import useDebounced from '../../hooks/useDebounced.js';
import { Alert, Badge, DataState, PageHeader, AddButton, confirmDelete } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { Icon } from '../../components/Icons.jsx';
import { FUEL, VEHICLE_STATUS, formatKm, isStaff } from '../../utils/format.js';
import VehicleForm from './VehicleForm.jsx';
import CategoriesModal from './CategoriesModal.jsx';

export default function Vehicles() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ q: '', category_id: '', status: searchParams.get('status') ?? '', fuel_type: '' });
  const [modal, setModal] = useState(null); // { type: 'form' | 'categories', vehicle? }
  const [actionError, setActionError] = useState('');

  const q = useDebounced(filters.q);
  const params = Object.fromEntries(Object.entries({ ...filters, q }).filter(([, v]) => v));
  const vehicles = useFetch('/vehicles', params);
  const categories = useFetch('/categories');

  const set = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));
  const refresh = () => {
    vehicles.reload();
    categories.reload();
  };

  const remove = async (v) => {
    if (!(await confirmDelete(`Supprimer ${v.brand} ${v.model} (${v.registration}) ?`))) return;
    setActionError('');
    try {
      await api.delete(`/vehicles/${v.id}`);
      refresh();
    } catch (err) {
      setActionError(`${errorMessage(err)}. Passez plutôt le véhicule « Hors service » pour conserver son historique.`);
    }
  };

  return (
    <>
      <PageHeader title="Véhicules">
        {staff && (
          <>
            <button className="btn btn-ghost" onClick={() => setModal({ type: 'categories' })}>Catégories</button>
            <AddButton onClick={() => setModal({ type: 'form' })}>Ajouter un véhicule</AddButton>
          </>
        )}
      </PageHeader>

      <div className="filters">
        <div className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Immatriculation, marque, modèle…" value={filters.q} onChange={set('q')} />
        </div>
        <Select value={filters.category_id} onChange={set('category_id')}>
          <option value="">Toutes catégories</option>
          {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={filters.status} onChange={set('status')}>
          <option value="">Tous statuts</option>
          {Object.entries(VEHICLE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select value={filters.fuel_type} onChange={set('fuel_type')}>
          <option value="">Tous carburants</option>
          {Object.entries(FUEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>

      <Alert>{actionError}</Alert>
      <DataState loading={vehicles.loading} error={vehicles.error} empty={vehicles.data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Immatriculation</th><th>Véhicule</th><th>Catégorie</th><th>Carburant</th><th>Places</th><th>Kilométrage</th><th>Statut</th>{staff && <th />}</tr>
            </thead>
            <tbody>
              {vehicles.data?.map((v) => (
                <tr key={v.id}>
                  <td><Link to={`/vehicles/${v.id}`}>{v.registration}</Link></td>
                  <td>{v.brand} {v.model} {v.year && <small className="muted">{v.year}</small>}</td>
                  <td>{v.category_name ?? '—'}</td>
                  <td>{FUEL[v.fuel_type]}</td>
                  <td>{v.seats}</td>
                  <td>{formatKm(v.mileage)}</td>
                  <td><Badge status={v.display_status} label={VEHICLE_STATUS[v.display_status]} /></td>
                  {staff && (
                    <td className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'form', vehicle: v })}>Modifier</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(v)}>Supprimer</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      {modal?.type === 'form' && (
        <VehicleForm
          vehicle={modal.vehicle}
          categories={categories.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
      {modal?.type === 'categories' && (
        <CategoriesModal categories={categories.data ?? []} onClose={() => setModal(null)} onChanged={refresh} />
      )}
    </>
  );
}

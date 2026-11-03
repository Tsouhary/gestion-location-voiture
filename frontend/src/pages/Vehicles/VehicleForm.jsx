import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useForm from '../../hooks/useForm.js';
import { Alert, Field, Modal } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { FUEL, GEARBOX } from '../../utils/format.js';

const EMPTY = {
  registration: '', brand: '', model: '', year: '', color: '', category_id: '', fuel_type: 'diesel',
  transmission: 'manuelle', seats: 5, mileage: 0, daily_rate: 0, first_registration_date: '', insurance_company: '',
  insurance_expiry: '', technical_inspection_expiry: '', status: 'available', description: '',
};

const fromVehicle = (v) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, v[k] ?? '']));

export default function VehicleForm({ vehicle, categories, onClose, onSaved }) {
  const { values, bind } = useForm(vehicle ? fromVehicle(vehicle) : EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (vehicle) await api.put(`/vehicles/${vehicle.id}`, values);
      else await api.post('/vehicles', values);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={vehicle ? 'Modifier le véhicule' : 'Nouveau véhicule'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <Field label="Immatriculation *"><input required maxLength={20} {...bind('registration')} /></Field>
        <Field label="Catégorie">
          <Select {...bind('category_id')}>
            <option value="">— Aucune —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Marque *"><input required {...bind('brand')} /></Field>
        <Field label="Modèle *"><input required {...bind('model')} /></Field>
        <Field label="Année"><input type="number" min="1950" max="2100" {...bind('year')} /></Field>
        <Field label="Couleur"><input {...bind('color')} /></Field>
        <Field label="Carburant">
          <Select {...bind('fuel_type')}>{Object.entries(FUEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label="Boîte de vitesse">
          <Select {...bind('transmission')}>{Object.entries(GEARBOX).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label="Nombre de places"><input type="number" min="1" max="100" {...bind('seats')} /></Field>
        <Field label="Kilométrage"><input type="number" min="0" {...bind('mileage')} /></Field>
        <Field label="Tarif de location par jour (Ar)"><input type="number" min="0" step="any" {...bind('daily_rate')} /></Field>
        <Field label="Mise en circulation"><input type="date" {...bind('first_registration_date')} /></Field>
        <Field label="Assurance (compagnie)"><input {...bind('insurance_company')} /></Field>
        <Field label="Expiration assurance"><input type="date" {...bind('insurance_expiry')} /></Field>
        <Field label="Expiration contrôle technique"><input type="date" {...bind('technical_inspection_expiry')} /></Field>
        <Field label="Statut">
          <Select {...bind('status')}>
            <option value="available">Disponible</option>
            <option value="in_mission">En mission</option>
            <option value="maintenance">En maintenance</option>
            <option value="out_of_service">Hors service</option>
          </Select>
        </Field>
        <Field label="Description" wide><textarea rows="3" {...bind('description')} /></Field>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

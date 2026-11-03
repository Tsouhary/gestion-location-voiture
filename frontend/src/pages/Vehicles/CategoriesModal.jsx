import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { Alert, Modal, confirmDelete } from '../../components/ui.jsx';

export default function CategoriesModal({ categories, onClose, onChanged }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/categories', { name });
      setName('');
    });
  };

  const remove = async (c) => {
    if (await confirmDelete(`Supprimer la catégorie « ${c.name} » ? Ses ${c.vehicle_count} véhicule(s) n'auront plus de catégorie.`)) {
      run(() => api.delete(`/categories/${c.id}`));
    }
  };

  return (
    <Modal title="Catégories de véhicules" onClose={onClose}>
      <Alert>{error}</Alert>
      <ul className="plain-list">
        {categories.map((c) => (
          <li key={c.id}>
            <span>{c.name} <small className="muted">({c.vehicle_count})</small></span>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c)}>Supprimer</button>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input placeholder="Nouvelle catégorie" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary">Ajouter</button>
      </form>
    </Modal>
  );
}

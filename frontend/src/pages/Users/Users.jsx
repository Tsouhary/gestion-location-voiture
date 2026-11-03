import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import useForm from '../../hooks/useForm.js';
import { Alert, Badge, DataState, Field, Modal, PageHeader, AddButton, confirmDelete } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { ROLE_LABEL, formatDate } from '../../utils/format.js';

function UserForm({ target, onClose, onSaved }) {
  const { values, bind, bindCheck } = useForm(
    target
      ? { first_name: target.first_name, last_name: target.last_name, email: target.email, phone: target.phone ?? '', role: target.role, active: Boolean(target.active), password: '' }
      : { first_name: '', last_name: '', email: '', phone: '', role: 'user', active: true, password: '' },
  );
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    const body = { ...values };
    if (target && !body.password) delete body.password; // vide = mot de passe inchangé
    try {
      if (target) await api.put(`/users/${target.id}`, body);
      else await api.post('/users', body);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal title={target ? "Modifier l'utilisateur" : 'Nouvel utilisateur'} onClose={onClose}>
      <form className="form-grid" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
        <Field label="Prénom *"><input required {...bind('first_name')} /></Field>
        <Field label="Nom *"><input required {...bind('last_name')} /></Field>
        <Field label="Email *" wide><input type="email" required {...bind('email')} /></Field>
        <Field label="Téléphone"><input {...bind('phone')} /></Field>
        <Field label="Rôle">
          <Select {...bind('role')}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label={target ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe * (8 caractères min.)'} wide>
          <input type="password" autoComplete="new-password" minLength={8} required={!target} {...bind('password')} />
        </Field>
        <label className="field-wide check"><input type="checkbox" {...bindCheck('active')} /> Compte actif</label>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const users = useFetch('/users');
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');

  const remove = async (u) => {
    if (!(await confirmDelete(`Supprimer le compte de ${u.first_name} ${u.last_name} ?`))) return;
    setActionError('');
    try {
      await api.delete(`/users/${u.id}`);
      users.reload();
    } catch (err) {
      setActionError(`${errorMessage(err)}. Désactivez plutôt le compte pour conserver l'historique.`);
    }
  };

  return (
    <>
      <PageHeader title="Utilisateurs">
        <AddButton onClick={() => setModal({})}>Ajouter un utilisateur</AddButton>
      </PageHeader>
      <Alert>{actionError}</Alert>
      <DataState loading={users.loading} error={users.error} empty={users.data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Créé le</th><th /></tr></thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>{u.first_name} {u.last_name}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td><Badge status={u.active ? 'available' : 'unavailable'} label={u.active ? 'Actif' : 'Désactivé'} /></td>
                  <td>{formatDate(u.created_at)}</td>
                  <td className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setModal({ target: u })}>Modifier</button>
                    {u.id !== me.id && <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>Supprimer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {modal && <UserForm target={modal.target} onClose={() => setModal(null)} onSaved={() => { setModal(null); users.reload(); }} />}
    </>
  );
}

import { useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useForm from '../../hooks/useForm.js';
import { Alert, Field, PageHeader } from '../../components/ui.jsx';
import { ROLE_LABEL } from '../../utils/format.js';

function ProfileForm() {
  const { user, setUser } = useAuth();
  const { values, bind } = useForm({ first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '' });
  const [msg, setMsg] = useState({ error: '', ok: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/auth/me', values);
      setUser((u) => ({ ...u, ...res.data }));
      setMsg({ error: '', ok: 'Profil mis à jour' });
    } catch (err) {
      setMsg({ error: errorMessage(err), ok: '' });
    }
  };

  return (
    <form className="card form-grid" onSubmit={onSubmit}>
      <h2 className="field-wide">Mes informations</h2>
      <Alert>{msg.error}</Alert>
      <Alert tone="ok">{msg.ok}</Alert>
      <Field label="Prénom"><input required {...bind('first_name')} /></Field>
      <Field label="Nom"><input required {...bind('last_name')} /></Field>
      <Field label="Email"><input value={user.email} disabled /></Field>
      <Field label="Rôle"><input value={ROLE_LABEL[user.role]} disabled /></Field>
      <Field label="Téléphone"><input {...bind('phone')} /></Field>
      <div className="field-wide"><button className="btn btn-primary">Enregistrer</button></div>
    </form>
  );
}

function PasswordForm() {
  const { values, setValues, bind } = useForm({ current_password: '', new_password: '', confirm: '' });
  const [msg, setMsg] = useState({ error: '', ok: '' });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (values.new_password !== values.confirm) return setMsg({ error: 'Les deux mots de passe ne correspondent pas', ok: '' });
    try {
      await api.put('/auth/password', { current_password: values.current_password, new_password: values.new_password });
      setValues({ current_password: '', new_password: '', confirm: '' });
      setMsg({ error: '', ok: 'Mot de passe modifié' });
    } catch (err) {
      setMsg({ error: errorMessage(err), ok: '' });
    }
  };

  return (
    <form className="card form-grid" onSubmit={onSubmit}>
      <h2 className="field-wide">Changer le mot de passe</h2>
      <Alert>{msg.error}</Alert>
      <Alert tone="ok">{msg.ok}</Alert>
      <Field label="Mot de passe actuel" wide><input type="password" autoComplete="current-password" required {...bind('current_password')} /></Field>
      <Field label="Nouveau mot de passe (8 caractères min.)"><input type="password" autoComplete="new-password" minLength={8} required {...bind('new_password')} /></Field>
      <Field label="Confirmation"><input type="password" autoComplete="new-password" minLength={8} required {...bind('confirm')} /></Field>
      <div className="field-wide"><button className="btn btn-primary">Modifier</button></div>
    </form>
  );
}

export default function Profile() {
  return (
    <>
      <PageHeader title="Mon profil" />
      <div className="stack">
        <ProfileForm />
        <PasswordForm />
      </div>
    </>
  );
}

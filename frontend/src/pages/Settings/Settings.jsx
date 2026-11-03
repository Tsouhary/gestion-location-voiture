import { useEffect, useState } from 'react';
import api, { errorMessage } from '../../services/api.js';
import useFetch from '../../hooks/useFetch.js';
import useForm from '../../hooks/useForm.js';
import { Alert, DataState, Field, PageHeader } from '../../components/ui.jsx';
import { DocHeader } from '../../components/Document.jsx';
import { Icon } from '../../components/Icons.jsx';

const EMPTY = { org_name: '', org_address: '', org_city: '', org_phone: '', org_email: '', org_nif: '', org_stat: '' };
const KEYS = Object.keys(EMPTY);
const pick = (src) => Object.fromEntries(KEYS.map((k) => [k, src?.[k] ?? '']));

function Section({ icon, title, description, children }) {
  return (
    <section className="card settings-section">
      <header className="section-title">
        <span className="section-icon"><Icon name={icon} size={20} /></span>
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </header>
      <div className="form-grid">{children}</div>
    </section>
  );
}

/** Aperçu en direct de l'en-tête tel qu'il apparaîtra sur les factures, reçus et contrats. */
function HeaderPreview({ values }) {
  const org = {
    name: values.org_name || "Nom de l'organisation",
    address: values.org_address,
    city: values.org_city,
    phone: values.org_phone,
    email: values.org_email,
    nif: values.org_nif,
    stat: values.org_stat,
  };
  return (
    <aside className="settings-preview" aria-label="Aperçu de l'en-tête des documents">
      <div className="preview-label"><Icon name="eye" size={16} />Aperçu de l'en-tête des documents</div>
      <div className="doc preview-doc">
        <DocHeader org={org} kind="FACTURE" number="2026-0001" />
        <div className="preview-lines" aria-hidden="true">
          <span style={{ width: '38%' }} />
          <span style={{ width: '82%' }} />
          <span style={{ width: '64%' }} />
          <span style={{ width: '74%' }} />
        </div>
        <div className="preview-foot">
          Fait à {values.org_city || '…'}, le {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
      <p className="muted preview-hint">L'aperçu se met à jour pendant la saisie.</p>
    </aside>
  );
}

export default function Settings() {
  const { data, loading, error } = useFetch('/settings');
  const { values, setValues, bind } = useForm(EMPTY);
  const [saved, setSaved] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ error: '', ok: '' });

  useEffect(() => {
    if (data) {
      setValues(pick(data));
      setSaved(pick(data));
    }
  }, [data, setValues]);

  // Le message de succès disparaît de lui-même.
  useEffect(() => {
    if (!msg.ok) return undefined;
    const t = setTimeout(() => setMsg((m) => ({ ...m, ok: '' })), 4000);
    return () => clearTimeout(t);
  }, [msg.ok]);

  const dirty = KEYS.some((k) => values[k] !== saved[k]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/settings', values);
      setSaved(pick(res.data));
      setValues(pick(res.data));
      setMsg({ error: '', ok: 'Paramètres enregistrés' });
    } catch (err) {
      setMsg({ error: errorMessage(err), ok: '' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setValues(saved);
    setMsg({ error: '', ok: '' });
  };

  return (
    <>
      <PageHeader title="Paramètres" />
      <DataState loading={loading} error={error}>
        <div className="settings">
          <form className="settings-form" onSubmit={submit}>
            <Alert>{msg.error}</Alert>

            <Section icon="building" title="Identité" description="Nom et adresse affichés en en-tête de vos documents.">
              <Field label="Nom de l'organisation *" icon="building" wide>
                <input required maxLength={120} placeholder="Ex. Société Malagasy de Transport" {...bind('org_name')} />
              </Field>
              <Field label="Adresse" icon="pin" wide>
                <input maxLength={200} placeholder="Numéro, rue, quartier" {...bind('org_address')} />
              </Field>
              <Field label="Ville" icon="pin" hint="Utilisée dans la formule « Fait à … » des contrats." wide>
                <input maxLength={80} placeholder="Antananarivo" {...bind('org_city')} />
              </Field>
            </Section>

            <Section icon="phone" title="Contact" description="Comment vos clients peuvent vous joindre.">
              <Field label="Téléphone" icon="phone">
                <input type="tel" maxLength={40} placeholder="020 22 000 00" {...bind('org_phone')} />
              </Field>
              <Field label="Email" icon="mail">
                <input type="email" placeholder="contact@exemple.mg" {...bind('org_email')} />
              </Field>
            </Section>

            <Section icon="file" title="Informations fiscales" description="Mentions légales obligatoires sur les factures.">
              <Field label="NIF" icon="hash">
                <input maxLength={40} placeholder="Numéro d'identification fiscale" {...bind('org_nif')} />
              </Field>
              <Field label="STAT" icon="hash">
                <input maxLength={40} placeholder="Numéro statistique" {...bind('org_stat')} />
              </Field>
            </Section>

            <div className="card settings-actions">
              <span className={`save-status${dirty ? ' is-dirty' : ''}${msg.ok && !dirty ? ' is-ok' : ''}`} role="status">
                {dirty && <><i className="dot" />Modifications non enregistrées</>}
                {!dirty && msg.ok && <><Icon name="check" size={16} />{msg.ok}</>}
              </span>
              <div className="actions">
                <button type="button" className="btn btn-ghost" onClick={reset} disabled={!dirty || saving}>Annuler</button>
                <button className="btn btn-primary" disabled={!dirty || saving}>
                  {saving ? <><span className="spinner" />Enregistrement…</> : 'Enregistrer'}
                </button>
              </div>
            </div>
          </form>

          <HeaderPreview values={values} />
        </div>
      </DataState>
    </>
  );
}

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { errorMessage } from '../../services/api.js';
import useForm from '../../hooks/useForm.js';
import useTheme from '../../hooks/useTheme.js';
import { Alert, Field } from '../../components/ui.jsx';
import { Icon } from '../../components/Icons.jsx';

const FEATURES = [
  { icon: 'calendar', title: 'Réservations en ligne', text: 'Demandez un véhicule, suivez la validation et le départ en mission.' },
  { icon: 'wrench', title: 'Entretiens et échéances', text: 'Assurance, contrôle technique, permis : rien ne passe entre les mailles.' },
  { icon: 'receipt', title: 'Contrats, factures et reçus', text: 'Documents prêts à imprimer, paiements suivis jusqu’au dernier ariary.' },
];

export default function Login() {
  const { user, login } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { values, bind } = useForm({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(values.email, values.password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-split">
      <aside className="login-hero">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        <div className="hero-brand">
          <span className="brand-mark"><Icon name="car" size={20} /></span>
          <span>Parc<strong>Auto</strong></span>
        </div>

        <div className="hero-copy">
          <h2>Votre parc automobile, <span>simplement géré.</span></h2>
          <p>Réservez, validez, suivez et facturez au même endroit.</p>
          <ul className="hero-features">
            {FEATURES.map((f) => (
              <li key={f.icon}>
                <span className="feature-icon"><Icon name={f.icon} size={20} /></span>
                <div><strong>{f.title}</strong><span>{f.text}</span></div>
              </li>
            ))}
          </ul>
        </div>

        <small className="hero-foot">Gestion du parc automobile</small>
      </aside>

      <main className="login-panel">
        <button type="button" className="icon-btn theme-btn login-theme" onClick={toggle} aria-label="Changer de thème">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
        </button>

        <form className="login-form" onSubmit={onSubmit}>
          <div>
            <h1>Connexion</h1>
            <p className="muted">Heureux de vous revoir. Connectez-vous pour gérer et réserver les véhicules du parc.</p>
          </div>

          <Alert>{error}</Alert>

          <Field label="Adresse email" icon="mail">
            <input type="email" autoComplete="username" required autoFocus placeholder="vous@exemple.mg" {...bind('email')} />
          </Field>

          <Field label="Mot de passe" icon="lock">
            <>
              <input
                className="pw-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Votre mot de passe"
                onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
                {...bind('password')}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </>
          </Field>
          {capsLock && <div className="caps-hint" role="status"><Icon name="alert" size={15} />Verrouillage majuscules activé</div>}

          <button className="btn btn-primary btn-block btn-lg login-submit" disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {busy ? 'Connexion…' : <>Se connecter<Icon name="arrowRight" size={18} /></>}
          </button>
        </form>
      </main>
    </div>
  );
}

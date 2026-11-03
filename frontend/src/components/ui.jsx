import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TONE } from '../utils/format.js';
import { Icon } from './Icons.jsx';

export function Badge({ status, label }) {
  return <span className={`badge badge-${TONE[status] ?? 'gray'}`}>{label}</span>;
}

export function Alert({ children, tone = 'error' }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={{ error: 'alert', ok: 'check', info: 'info' }[tone]} size={18} />
      <span>{children}</span>
    </div>
  );
}

/** Champ de formulaire ; `icon` ajoute une icône dans le champ, `hint` un texte d'aide sous le champ. */
export function Field({ label, children, wide, icon, hint }) {
  return (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span>{label}</span>
      {icon ? (
        <span className="input-icon">
          <Icon name={icon} size={17} />
          {children}
        </span>
      ) : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

// Fenêtres ouvertes, de la plus ancienne à la plus récente : Échap ne ferme que celle du dessus.
const openModals = [];

function useEscapeClose(onClose) {
  // `onClose` change à chaque rendu du parent : on le garde dans une ref pour que la fenêtre
  // ne quitte pas sa place dans la pile (sinon un re-rendu du parent la ferait repasser « au-dessus »).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const token = {};
    openModals.push(token);
    const onKey = (e) => e.key === 'Escape' && openModals[openModals.length - 1] === token && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      openModals.splice(openModals.indexOf(token), 1);
    };
  }, []);
}

/** `doc` : grand modal pour un document imprimable (contrat, facture…), imprimé seul à la place de la page. */
export function Modal({ title, onClose, children, wide, doc }) {
  useEscapeClose(onClose);

  return createPortal(
    <div className={`overlay${doc ? ' doc-modal' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}${doc ? ' modal-doc' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <div className="page-actions">{children}</div>
    </div>
  );
}

/** Bouton d'action principal avec icône « + ». */
export function AddButton({ children, ...props }) {
  return (
    <button className="btn btn-primary" {...props}>
      <Icon name="plus" size={16} />
      {children}
    </button>
  );
}

function Skeleton() {
  return (
    <div className="skeleton-card" aria-busy="true" aria-label="Chargement">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="skeleton" style={{ width: '12%' }} />
          <span className="skeleton" style={{ width: '28%' }} />
          <span className="skeleton" style={{ width: '20%' }} />
          <span className="skeleton" style={{ width: '14%' }} />
        </div>
      ))}
    </div>
  );
}

export function DataState({ loading, error, empty, children }) {
  if (loading) return <Skeleton />;
  if (error) return <Alert>{error}</Alert>;
  if (empty) {
    return (
      <div className="empty-state">
        <Icon name="inbox" size={40} />
        <p>Aucun résultat</p>
      </div>
    );
  }
  return children;
}

// ---------- Confirmation ----------
let openConfirm = null;

/**
 * Demande une confirmation dans une fenêtre du site (remplace `window.confirm`). Renvoie une promesse : `true` si l'utilisateur
 * confirme, `false` s'il annule (bouton, Échap ou clic à côté). À appeler avec `await`.
 * Options : `title`, `confirmLabel`, `cancelLabel`, `tone` ('primary' | 'danger'), `icon`.
 */
export function confirmAction(message, options = {}) {
  if (!openConfirm) return Promise.resolve(window.confirm(message)); // ConfirmHost pas encore monté
  return openConfirm(message, options);
}

/** Confirmation de suppression : bouton rouge « Supprimer », focus sur « Annuler ». */
export const confirmDelete = (message, options = {}) => confirmAction(message, {
  title: 'Confirmer la suppression', confirmLabel: 'Supprimer', tone: 'danger', icon: 'trash', ...options,
});

function ConfirmDialog({ message, title = 'Confirmation', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', tone = 'primary', icon, onAnswer }) {
  useEscapeClose(() => onAnswer(false));
  const danger = tone === 'danger';
  return createPortal(
    <div className="overlay confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onAnswer(false)}>
      <div className="modal modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span className={`confirm-icon${danger ? ' is-danger' : ''}`}><Icon name={icon ?? (danger ? 'alert' : 'info')} size={26} /></span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          {/* Action destructrice : le focus est sur « Annuler » pour qu'Entrée ne détruise rien par réflexe. */}
          <button type="button" className="btn btn-ghost" autoFocus={danger} onClick={() => onAnswer(false)}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger-fill' : 'btn-primary'}`} autoFocus={!danger} onClick={() => onAnswer(true)}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** À monter une fois, à la racine de l'application. */
export function ConfirmHost() {
  const [dialog, setDialog] = useState(null);
  const pending = useRef(null);

  useEffect(() => {
    openConfirm = (message, options) => new Promise((resolve) => {
      pending.current?.(false); // une confirmation déjà ouverte est considérée comme annulée
      pending.current = resolve;
      setDialog({ message, options });
    });
    return () => {
      openConfirm = null;
      pending.current?.(false);
      pending.current = null;
    };
  }, []);

  const answer = (value) => {
    pending.current?.(value);
    pending.current = null;
    setDialog(null);
  };

  return dialog ? <ConfirmDialog message={dialog.message} {...dialog.options} onAnswer={answer} /> : null;
}

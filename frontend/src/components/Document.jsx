import { Link } from 'react-router-dom';
import { Modal, PageHeader } from './ui.jsx';
import { Icon } from './Icons.jsx';

/**
 * Document imprimable : barre d'actions à l'écran (masquée à l'impression) + feuille A4.
 * Avec `onClose`, il s'affiche dans un modal au lieu d'une page (le lien « Retour » devient inutile).
 */
export function DocumentPage({ title, backTo, actions, notice, onClose, children }) {
  if (onClose) {
    return (
      <Modal title={title} onClose={onClose} doc>
        <div className="no-print">
          <div className="doc-toolbar">
            {actions}
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Icon name="printer" size={16} />Imprimer / PDF
            </button>
          </div>
          {notice}
        </div>
        <article className="doc">{children}</article>
      </Modal>
    );
  }
  return (
    <>
      <div className="no-print">
        <PageHeader title={title}>
          {actions}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Icon name="printer" size={16} />Imprimer / PDF
          </button>
          <Link className="btn btn-ghost" to={backTo}><Icon name="arrowLeft" size={16} />Retour</Link>
        </PageHeader>
        {notice}
      </div>
      <article className="doc">{children}</article>
    </>
  );
}

const orgLines = (org) => [
  [org.address, org.city].filter(Boolean).join(', '),
  [org.phone && `Tél : ${org.phone}`, org.email].filter(Boolean).join(' · '),
  [org.nif && `NIF : ${org.nif}`, org.stat && `STAT : ${org.stat}`].filter(Boolean).join(' · '),
].filter(Boolean);

/** En-tête : identité de l'organisation à gauche, type / numéro / date du document à droite. */
export function DocHeader({ org, kind, number, dateLabel }) {
  return (
    <header className="doc-head">
      <div className="doc-org">
        <span className="doc-logo"><Icon name="car" size={22} /></span>
        <div>
          <strong>{org.name}</strong>
          {orgLines(org).map((l) => <div key={l}>{l}</div>)}
        </div>
      </div>
      <div className="doc-title">
        <h2>{kind}</h2>
        <div className="doc-number">N° {number}</div>
        {dateLabel && <div className="doc-date">{dateLabel}</div>}
      </div>
    </header>
  );
}

export function DocParty({ label, children }) {
  return (
    <div className="doc-party">
      <div className="doc-label">{label}</div>
      {children}
    </div>
  );
}

/** Tampon diagonal (PAYÉE, ANNULÉE…). `tone` : green | red | gray | amber. */
export function Stamp({ tone = 'green', children }) {
  return <div className={`doc-stamp stamp-${tone}`}>{children}</div>;
}

export function DocSignature({ left, right }) {
  return (
    <div className="doc-signatures">
      <div><div className="doc-label">{left}</div><div className="sign-space" /></div>
      <div><div className="doc-label">{right}</div><div className="sign-space" /></div>
    </div>
  );
}

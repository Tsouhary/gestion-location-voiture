import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import { Alert, Badge, DataState, PageHeader, AddButton, confirmAction } from '../../components/ui.jsx';
import { Icon } from '../../components/Icons.jsx';
import {
  RESERVATION_STATUS, TONE, formatDayShort, formatDuration, formatPeriod, initials, isStaff,
} from '../../utils/format.js';
import ReservationForm from './ReservationForm.jsx';
import { AssignModal, CompleteModal, RejectModal } from './ReservationModals.jsx';
import ContractView from '../Contracts/ContractView.jsx';
import InvoiceView from '../Billing/InvoiceView.jsx';

/** Une réservation : date, destination, période, véhicule, conducteur, statut et actions. */
function ReservationCard({ r, staff, actions }) {
  const duration = formatDuration(r.start_at, r.end_at);
  const [day, month] = formatDayShort(r.start_at).split(' ');
  return (
    <article className={`resa-card tone-${TONE[r.status] ?? 'gray'}`}>
      <header className="resa-head">
        <div className="resa-date" aria-hidden="true"><strong>{day}</strong><span>{month}</span></div>
        <div className="resa-title">
          <h3>{r.destination}</h3>
          {r.purpose && <p>{r.purpose}</p>}
        </div>
        <Badge status={r.status} label={RESERVATION_STATUS[r.status]} />
      </header>

      <div className="resa-meta">
        <div className="meta-item meta-wide">
          <span className="meta-icon"><Icon name="clock" size={17} /></span>
          <div>
            <span className="meta-label">Période</span>
            <span className="meta-value">{formatPeriod(r.start_at, r.end_at)}{duration && <span className="chip">{duration}</span>}</span>
          </div>
        </div>
        <div className="meta-item">
          <span className="meta-icon"><Icon name="car" size={17} /></span>
          <div>
            <span className="meta-label">Véhicule</span>
            {r.registration
              ? <span className="meta-value">{r.brand} {r.model} <span className="plate">{r.registration}</span></span>
              : <span className="meta-value is-empty">Non attribué</span>}
          </div>
        </div>
        <div className="meta-item">
          <span className="meta-icon"><Icon name="user" size={17} /></span>
          <div>
            <span className="meta-label">Conducteur</span>
            {r.driver_name
              ? <span className="meta-value">{r.driver_name}</span>
              : <span className="meta-value is-empty">{r.driver_requested ? 'Demandé, à attribuer' : 'Sans conducteur'}</span>}
          </div>
        </div>
      </div>

      {r.status === 'rejected' && r.rejection_reason && (
        <div className="resa-note" role="note"><Icon name="alert" size={16} /><span><strong>Motif du refus :</strong> {r.rejection_reason}</span></div>
      )}

      <footer className="resa-foot">
        <span className="resa-who">
          {staff && r.requester_name && <><span className="avatar avatar-sm" aria-hidden="true">{initials(r.requester_name)}</span>{r.requester_name}</>}
          <span className="resa-ref">#{r.id}</span>
        </span>
        <div className="resa-actions">
          {actions.map(([label, cls, fn]) => (
            <button key={label} type="button" className={`btn btn-sm ${cls}`} onClick={fn}>{label}</button>
          ))}
        </div>
      </footer>
    </article>
  );
}

export default function Reservations() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const canRequest = user.role !== 'driver';
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const reservations = useFetch('/reservations');
  const [modal, setModal] = useState(null); // { type: 'form' | 'assign' | 'reject' | 'complete' | 'contract' | 'invoice', reservation?, id? }
  const [actionError, setActionError] = useState('');

  // Lien "Nouvelle réservation" du tableau de bord.
  useEffect(() => {
    if (searchParams.get('new') && canRequest) {
      setModal({ type: 'form' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, canRequest]);

  const done = () => {
    setModal(null);
    reservations.reload();
  };

  // `confirm` : [message, options] de la fenêtre de confirmation (facultatif).
  const act = async (r, path, confirm) => {
    if (confirm && !(await confirmAction(...confirm))) return;
    setActionError('');
    try {
      await api.put(`/reservations/${r.id}/${path}`);
      reservations.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const createInvoice = async (r) => {
    setActionError('');
    try {
      const res = await api.post(`/reservations/${r.id}/invoice`, {});
      reservations.reload(); // le bouton « Créer la facture » devient « Facture »
      setModal({ type: 'invoice', id: res.data.id });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const actionsFor = (r) => {
    const mine = r.user_id === user.id;
    const buttons = [];
    if (r.status === 'pending') {
      if (staff) {
        buttons.push(['Valider', 'btn-primary', () => setModal({ type: 'assign', reservation: r })]);
        buttons.push(['Refuser', 'btn-danger', () => setModal({ type: 'reject', reservation: r })]);
      }
      if (staff || mine) buttons.push(['Modifier', 'btn-ghost', () => setModal({ type: 'form', reservation: r })]);
    }
    if (r.status === 'validated' && staff) buttons.push(['Démarrer', 'btn-primary', () => act(r, 'start', ['Confirmer le départ du véhicule ?', { title: 'Démarrer la mission', confirmLabel: 'Démarrer' }])]);
    if (r.status === 'in_progress' && staff) buttons.push(['Terminer', 'btn-primary', () => setModal({ type: 'complete', reservation: r })]);
    if (['pending', 'validated'].includes(r.status) && (staff || mine)) {
      buttons.push(['Annuler', 'btn-ghost', () => act(r, 'cancel', ['Annuler cette réservation ?', { title: 'Annuler la réservation', confirmLabel: 'Annuler la réservation', cancelLabel: 'Retour', tone: 'danger' }])]);
    }
    if (['validated', 'in_progress', 'completed'].includes(r.status)) {
      buttons.push(['Contrat', 'btn-ghost', () => setModal({ type: 'contract', id: r.id })]);
      if (r.invoice_id && user.role !== 'driver') buttons.push(['Facture', 'btn-ghost', () => setModal({ type: 'invoice', id: r.invoice_id })]);
      else if (!r.invoice_id && staff) buttons.push(['Créer la facture', 'btn-ghost', () => createInvoice(r)]);
    }
    return buttons;
  };

  const all = reservations.data ?? [];
  const shown = status ? all.filter((r) => r.status === status) : all;
  const countOf = (key) => (key ? all.filter((r) => r.status === key).length : all.length);
  // « Toutes » + les statuts présents (et celui qui est sélectionné, même vide).
  const tabs = [['', 'Toutes'], ...Object.entries(RESERVATION_STATUS)]
    .map(([key, label]) => [key, label, countOf(key)])
    .filter(([key, , n]) => !key || n > 0 || key === status);

  return (
    <>
      <PageHeader title={staff ? 'Réservations' : 'Mes réservations'}>
        {canRequest && <AddButton onClick={() => setModal({ type: 'form' })}>Nouvelle réservation</AddButton>}
      </PageHeader>

      <div className="status-tabs" role="tablist" aria-label="Filtrer par statut">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={status === key}
            className={`status-tab${status === key ? ' is-active' : ''}`}
            onClick={() => setStatus(key)}
          >
            {label}<b>{n}</b>
          </button>
        ))}
      </div>

      <Alert>{actionError}</Alert>
      <DataState loading={reservations.loading && !reservations.data} error={reservations.error} empty={Boolean(reservations.data) && shown.length === 0}>
        <div className="resa-list stagger" key={status}>
          {shown.map((r) => <ReservationCard key={r.id} r={r} staff={staff} actions={actionsFor(r)} />)}
        </div>
      </DataState>

      {modal?.type === 'form' && <ReservationForm reservation={modal.reservation} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.type === 'assign' && <AssignModal reservation={modal.reservation} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'reject' && <RejectModal reservation={modal.reservation} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'contract' && <ContractView reservationId={modal.id} onClose={done} />}
      {modal?.type === 'invoice' && <InvoiceView id={modal.id} onClose={done} />}
      {modal?.type === 'complete' && <CompleteModal reservation={modal.reservation} onClose={() => setModal(null)} onDone={done} />}
    </>
  );
}

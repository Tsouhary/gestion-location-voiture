import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import useForm from '../../hooks/useForm.js';
import { Alert, Badge, DataState, Field, Modal, confirmDelete } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { Icon } from '../../components/Icons.jsx';
import { DocHeader, DocParty, DocumentPage, Stamp } from '../../components/Document.jsx';
import { INVOICE_STATUS, PAYMENT_METHOD, formatDate, formatDateLong, formatDateTime, formatMoney, isStaff } from '../../utils/format.js';
import { amountInWords } from '../../utils/numberToWords.js';

const nowInput = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function PaymentModal({ invoice, onClose }) {
  const navigate = useNavigate();
  const { values, bind } = useForm({ amount: invoice.balance, method: 'especes', reference: '', paid_at: nowInput() });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/invoices/${invoice.id}/payments`, values);
      navigate(`/receipts/${res.data.id}`); // le reçu est la pièce justificative : on l'affiche tout de suite
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Enregistrer un paiement" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <p className="field-wide muted">Facture {invoice.number} — reste à payer : <strong>{formatMoney(invoice.balance)}</strong></p>
        <Alert>{error}</Alert>
        <Field label="Montant reçu (Ar) *"><input type="number" required min="1" max={invoice.balance} step="any" autoFocus {...bind('amount')} /></Field>
        <Field label="Mode de paiement *">
          <Select {...bind('method')}>{Object.entries(PAYMENT_METHOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        </Field>
        <Field label="Référence (n° de transaction, de chèque…)" wide><input maxLength={80} {...bind('reference')} /></Field>
        <Field label="Date et heure du paiement" wide><input type="datetime-local" required max={nowInput()} {...bind('paid_at')} /></Field>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={busy}>Enregistrer et générer le reçu</button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ invoice, onClose, onSaved }) {
  const { values, bind } = useForm({ days: invoice.days, unit_price: invoice.unit_price, discount: invoice.discount, notes: invoice.notes ?? '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/invoices/${invoice.id}`, values);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal title={`Modifier la facture ${invoice.number}`} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Alert>{error}</Alert>
        <Field label="Nombre de jours"><input type="number" min="1" required {...bind('days')} /></Field>
        <Field label="Prix par jour (Ar)"><input type="number" min="0" step="any" required {...bind('unit_price')} /></Field>
        <Field label="Remise (Ar)" wide><input type="number" min="0" step="any" {...bind('discount')} /></Field>
        <Field label="Note affichée sur la facture" wide><input maxLength={255} {...bind('notes')} /></Field>
        <p className="field-wide muted">Le nouveau total ne peut pas être inférieur aux paiements déjà reçus ({formatMoney(invoice.paid)}).</p>
        <div className="field-wide actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/** Page `/invoices/:id`, ou modal si `id` et `onClose` sont fournis. */
export default function InvoiceView({ id: idProp, onClose }) {
  const params = useParams();
  const id = idProp ?? params.id;
  const { user } = useAuth();
  const staff = isStaff(user);
  const { data, loading, error, reload } = useFetch(`/invoices/${id}`);
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState('');

  const removePayment = async (p) => {
    if (!(await confirmDelete(`Supprimer le paiement ${p.receipt_number} (${formatMoney(p.amount)}) ? Cette action corrige une saisie erronée.`))) return;
    setActionError('');
    try {
      await api.delete(`/payments/${p.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (loading || error || !data) {
    const state = <DataState loading={loading} error={error}>{null}</DataState>;
    return onClose ? <Modal title="Facture" onClose={onClose} doc>{state}</Modal> : state;
  }

  const { org, invoice: inv, client, reservation: r, vehicle, payments } = data;
  const payable = staff && inv.status !== 'cancelled' && inv.balance > 0;
  const stamp = { paid: ['green', 'PAYÉE'], cancelled: ['gray', 'ANNULÉE'] }[inv.status];

  const actions = staff && (
    <>
      {inv.status !== 'cancelled' && (
        <button type="button" className="btn btn-ghost" onClick={() => setModal('edit')}><Icon name="edit" size={16} />Modifier</button>
      )}
      {payable && (
        <button type="button" className="btn btn-primary" onClick={() => setModal('pay')}><Icon name="card" size={16} />Enregistrer un paiement</button>
      )}
    </>
  );

  return (
    <>
      <DocumentPage title={`Facture ${inv.number}`} backTo="/invoices" onClose={onClose} actions={actions} notice={<Alert>{actionError}</Alert>}>
        {stamp && <Stamp tone={stamp[0]}>{stamp[1]}</Stamp>}
        <DocHeader org={org} kind="FACTURE" number={inv.number} dateLabel={`Émise le ${formatDateLong(inv.issue_date)}`} />

        <div className="doc-parties">
          <DocParty label="Facturé à">
            <strong>{client.name}</strong>
            {client.email && <div>{client.email}</div>}
            {client.phone && <div>{client.phone}</div>}
          </DocParty>
          <DocParty label="Réservation">
            <strong>N° {r.id} — {r.destination}</strong>
            <div>{formatDateTime(r.start_at)} → {formatDateTime(r.end_at)}</div>
            <div>{r.purpose}</div>
          </DocParty>
        </div>

        <table className="doc-table">
          <thead><tr><th>Désignation</th><th className="num">Jours</th><th className="num">Prix unitaire</th><th className="num">Montant</th></tr></thead>
          <tbody>
            <tr>
              <td>
                Location de véhicule{vehicle && <> : <strong>{vehicle.brand} {vehicle.model}</strong> ({vehicle.registration})</>}
                <div className="doc-sub">Du {formatDate(r.start_at)} au {formatDate(r.end_at)}</div>
              </td>
              <td className="num">{inv.days}</td>
              <td className="num">{formatMoney(inv.unit_price)}</td>
              <td className="num">{formatMoney(inv.subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className="doc-totals">
          <div><span>Sous-total</span><span>{formatMoney(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div><span>Remise</span><span>− {formatMoney(inv.discount)}</span></div>}
          <div className="grand"><span>Total à payer</span><span>{formatMoney(inv.total)}</span></div>
          <div><span>Déjà payé</span><span>{formatMoney(inv.paid)}</span></div>
          <div className="due"><span>Reste à payer</span><span>{formatMoney(inv.balance)}</span></div>
        </div>

        <p className="doc-words">Arrêtée la présente facture à la somme de : <strong>{amountInWords(inv.total)}</strong>.</p>
        {inv.notes && <p className="doc-note">{inv.notes}</p>}

        {payments.length > 0 && (
          <>
            <div className="doc-label">Paiements reçus</div>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Reçu n°</th><th>Date</th><th>Mode</th><th>Référence</th><th className="num">Montant</th>
                  {user.role === 'admin' && <th className="no-print" />}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap"><Link to={`/receipts/${p.id}`}>{p.receipt_number}</Link></td>
                    <td className="nowrap">{formatDateTime(p.paid_at)}</td>
                    <td>{PAYMENT_METHOD[p.method]}</td>
                    <td>{p.reference ?? '—'}</td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    {user.role === 'admin' && (
                      <td className="no-print num">
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removePayment(p)}>Supprimer</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="doc-foot">
          <span>Statut : <Badge status={inv.status} label={INVOICE_STATUS[inv.status]} /></span>
          <span>{org.name}{org.nif && ` — NIF ${org.nif}`}</span>
        </footer>
      </DocumentPage>

      {modal === 'pay' && <PaymentModal invoice={inv} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditModal invoice={inv} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}

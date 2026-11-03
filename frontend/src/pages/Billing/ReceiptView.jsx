import { Link, useParams } from 'react-router-dom';
import useFetch from '../../hooks/useFetch.js';
import { DataState } from '../../components/ui.jsx';
import { DocHeader, DocParty, DocSignature, DocumentPage, Stamp } from '../../components/Document.jsx';
import { PAYMENT_METHOD, formatDateLong, formatDateTime, formatMoney } from '../../utils/format.js';
import { amountInWords } from '../../utils/numberToWords.js';

/** Reçu de paiement : la pièce justificative remise au client pour un règlement. */
export default function ReceiptView() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(`/payments/${id}`);

  if (loading || error || !data) return <DataState loading={loading} error={error}>{null}</DataState>;

  const { org, receipt: p, invoice, client, reservation: r, vehicle } = data;
  const settled = p.balance_after <= 0;

  return (
    <DocumentPage title={`Reçu ${p.number}`} backTo={`/invoices/${invoice.id}`}>
      <Stamp tone={settled ? 'green' : 'amber'}>{settled ? 'SOLDÉ' : 'ACOMPTE'}</Stamp>
      <DocHeader org={org} kind="REÇU DE PAIEMENT" number={p.number} dateLabel={`Le ${formatDateLong(p.paid_at)}`} />

      <div className="doc-parties">
        <DocParty label="Reçu de">
          <strong>{client.name}</strong>
          {client.email && <div>{client.email}</div>}
          {client.phone && <div>{client.phone}</div>}
        </DocParty>
        <DocParty label="Règlement de la facture">
          <strong><Link to={`/invoices/${invoice.id}`}>{invoice.number}</Link></strong>
          <div>Réservation n° {r.id} — {r.destination}</div>
          {vehicle && <div>{vehicle.brand} {vehicle.model} ({vehicle.registration})</div>}
        </DocParty>
      </div>

      <div className="doc-amount">
        <div className="doc-label">Somme reçue</div>
        <div className="doc-amount-figure">{formatMoney(p.amount)}</div>
        <div className="doc-amount-words">{amountInWords(p.amount)}</div>
      </div>

      <table className="doc-table">
        <tbody>
          <tr><th>Mode de paiement</th><td>{PAYMENT_METHOD[p.method]}</td></tr>
          <tr><th>Référence</th><td>{p.reference ?? '—'}</td></tr>
          <tr><th>Date et heure</th><td>{formatDateTime(p.paid_at)}</td></tr>
          <tr><th>Montant total de la facture</th><td>{formatMoney(invoice.total)}</td></tr>
          <tr><th>Reste à payer après ce paiement</th><td><strong>{formatMoney(p.balance_after)}</strong></td></tr>
        </tbody>
      </table>

      <p className="doc-note">
        Le présent reçu atteste du paiement de la somme ci-dessus. Il ne dispense pas de conserver la facture correspondante.
      </p>

      <DocSignature left="Le payeur" right={`Reçu par ${p.recorded_by ?? 'le caissier'} — cachet et signature`} />
    </DocumentPage>
  );
}

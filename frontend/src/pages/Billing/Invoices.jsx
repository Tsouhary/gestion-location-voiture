import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import { Badge, DataState, PageHeader } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import Stat from '../../components/Stat.jsx';
import InvoiceView from './InvoiceView.jsx';
import { INVOICE_STATUS, formatDate, formatMoney, isStaff } from '../../utils/format.js';

export default function Invoices() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null); // facture affichée dans le modal
  const invoices = useFetch('/invoices', status ? { status } : {});
  const all = useFetch('/invoices'); // totaux calculés sur l'ensemble, indépendamment du filtre

  const active = (all.data ?? []).filter((i) => i.status !== 'cancelled');
  const billed = active.reduce((s, i) => s + i.total, 0);
  const collected = active.reduce((s, i) => s + i.paid, 0);
  const unpaidCount = active.filter((i) => i.balance > 0).length;

  return (
    <>
      <PageHeader title={staff ? 'Facturation' : 'Mes factures'} />

      {all.data && (
        <div className="stats stats-wide stagger" style={{ marginBottom: '1.25rem' }}>
          <Stat label="Total facturé" value={billed} icon="receipt" tone="indigo" format={formatMoney} />
          <Stat label="Encaissé" value={collected} icon="card" tone="green" format={formatMoney} />
          <Stat label="Reste à payer" value={billed - collected} icon="clock" tone="amber" format={formatMoney} highlight={billed - collected > 0} />
          <Stat label="Factures à régler" value={unpaidCount} icon="alert" tone="red" />
        </div>
      )}

      <div className="filters">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(INVOICE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>

      <DataState loading={invoices.loading} error={invoices.error} empty={invoices.data?.length === 0}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Facture</th><th>Date</th>{staff && <th>Client</th>}<th>Réservation</th>
                <th className="num">Total</th><th className="num">Payé</th><th className="num">Reste</th><th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {invoices.data?.map((i) => (
                <tr key={i.id}>
                  <td>
                    {/* href conservé (nouvel onglet, copie du lien) ; un clic simple ouvre le modal. */}
                    <a
                      href={`/invoices/${i.id}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        setOpenId(i.id);
                      }}
                    >
                      <strong>{i.number}</strong>
                    </a>
                  </td>
                  <td className="nowrap">{formatDate(i.issue_date)}</td>
                  {staff && <td>{i.first_name} {i.last_name}</td>}
                  <td className="cell-2">{i.destination}<small className="muted">{i.brand} {i.model} {i.registration}</small></td>
                  <td className="num nowrap">{formatMoney(i.total)}</td>
                  <td className="num nowrap">{formatMoney(i.paid)}</td>
                  <td className="num nowrap"><strong>{formatMoney(i.balance)}</strong></td>
                  <td><Badge status={i.status} label={INVOICE_STATUS[i.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      {openId && (
        <InvoiceView
          id={openId}
          onClose={() => {
            setOpenId(null);
            invoices.reload(); // paiements ou modifications faits dans le modal
            all.reload();
          }}
        />
      )}
    </>
  );
}

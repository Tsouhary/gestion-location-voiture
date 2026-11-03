import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { errorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useFetch from '../../hooks/useFetch.js';
import { Alert, DataState, Modal } from '../../components/ui.jsx';
import { Icon } from '../../components/Icons.jsx';
import { DocHeader, DocParty, DocSignature, DocumentPage, Stamp } from '../../components/Document.jsx';
import { FUEL, GEARBOX, formatDate, formatDateLong, formatDateTime, formatKm, formatMoney, isStaff } from '../../utils/format.js';

function MissingContract({ reservationId, staff, onCreated }) {
  const [error, setError] = useState('');
  const create = async () => {
    try {
      await api.post(`/reservations/${reservationId}/contract`);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <div className="empty-state">
      <Icon name="file" size={40} />
      <p>Aucun contrat n'a encore été généré pour cette réservation.</p>
      <Alert>{error}</Alert>
      {staff && <button type="button" className="btn btn-primary" onClick={create}>Générer le contrat</button>}
    </div>
  );
}

/** Page `/contracts/:reservationId`, ou modal si `reservationId` et `onClose` sont fournis. */
export default function ContractView({ reservationId: idProp, onClose }) {
  const params = useParams();
  const reservationId = idProp ?? params.reservationId;
  const { user } = useAuth();
  const staff = isStaff(user);
  const { data, loading, error, reload } = useFetch(`/reservations/${reservationId}/contract`);
  const [actionError, setActionError] = useState('');

  const sign = async () => {
    setActionError('');
    try {
      await api.put(`/contracts/${data.contract.id}/sign`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  // Dans un modal, les états intermédiaires (chargement, erreur, contrat manquant) restent aussi dans le modal.
  const inModal = (node) => (onClose ? <Modal title="Contrat" onClose={onClose} doc>{node}</Modal> : node);

  if (loading) return inModal(<DataState loading>{null}</DataState>);
  if (!data) {
    // 404 « aucun contrat » : le personnel peut le générer ; toute autre erreur est affichée telle quelle.
    if (error.includes('Aucun contrat')) return inModal(<MissingContract reservationId={reservationId} staff={staff} onCreated={reload} />);
    return inModal(<DataState error={error}>{null}</DataState>);
  }

  const { org, contract: c, client, reservation: r, vehicle, driver, invoice } = data;
  const signed = Boolean(c.signed_at);

  const actions = staff && !signed && (
    <button type="button" className="btn btn-ghost" onClick={sign}><Icon name="check" size={16} />Marquer comme signé</button>
  );
  const notice = staff && (
    <Alert tone="info">
      Modèle de contrat général : faites-le relire par un juriste avant de l'utiliser comme document contractuel.
    </Alert>
  );

  return (
    <DocumentPage title={`Contrat ${c.number}`} backTo="/reservations" onClose={onClose} actions={actions} notice={<>{notice}<Alert>{actionError}</Alert></>}>
      {signed && <Stamp tone="green">SIGNÉ</Stamp>}
      <DocHeader org={org} kind="CONTRAT DE MISE À DISPOSITION D'UN VÉHICULE" number={c.number} dateLabel={`Établi le ${formatDateLong(c.issued_at)}`} />

      <p className="doc-lead"><strong>Entre les soussignés :</strong></p>
      <div className="doc-parties">
        <DocParty label="L'Organisation">
          <strong>{org.name}</strong>
          {org.address && <div>{[org.address, org.city].filter(Boolean).join(', ')}</div>}
          {(org.nif || org.stat) && <div>{[org.nif && `NIF ${org.nif}`, org.stat && `STAT ${org.stat}`].filter(Boolean).join(' · ')}</div>}
          <div className="doc-sub">ci-après « l'Organisation »</div>
        </DocParty>
        <DocParty label="Le Bénéficiaire">
          <strong>{client.name}</strong>
          {client.email && <div>{client.email}</div>}
          {client.phone && <div>{client.phone}</div>}
          <div className="doc-sub">ci-après « le Bénéficiaire »</div>
        </DocParty>
      </div>
      <p>Il a été convenu ce qui suit.</p>

      <section className="doc-article">
        <h3>Article 1 — Objet</h3>
        <p>L'Organisation met à la disposition du Bénéficiaire le véhicule suivant, pour la mission décrite à l'article 2 :</p>
        {vehicle ? (
          <table className="doc-table doc-kv">
            <tbody>
              <tr><th>Véhicule</th><td>{vehicle.brand} {vehicle.model}{vehicle.year && ` (${vehicle.year})`}</td><th>Immatriculation</th><td>{vehicle.registration}</td></tr>
              <tr><th>Couleur</th><td>{vehicle.color ?? '—'}</td><th>Places</th><td>{vehicle.seats}</td></tr>
              <tr><th>Carburant</th><td>{FUEL[vehicle.fuel_type]}</td><th>Boîte</th><td>{GEARBOX[vehicle.transmission]}</td></tr>
              <tr><th>Kilométrage au départ</th><td>{formatKm(vehicle.mileage)}</td><th>Assurance</th><td>{vehicle.insurance_company ?? '—'}{vehicle.insurance_expiry && ` (jusqu'au ${formatDate(vehicle.insurance_expiry)})`}</td></tr>
            </tbody>
          </table>
        ) : <p className="muted">Véhicule non renseigné.</p>}
      </section>

      <section className="doc-article">
        <h3>Article 2 — Durée et mission</h3>
        <p>
          La mise à disposition débute le <strong>{formatDateTime(r.start_at)}</strong> et prend fin le <strong>{formatDateTime(r.end_at)}</strong>.
          Destination : <strong>{r.destination}</strong>. Motif : {r.purpose}. Nombre de passagers : {r.passengers}.
        </p>
      </section>

      <section className="doc-article">
        <h3>Article 3 — Conducteur</h3>
        {driver ? (
          <p>
            Le véhicule est conduit par <strong>{driver.name}</strong>, conducteur de l'Organisation
            {driver.license_number && <>, titulaire du permis n° {driver.license_number}{driver.license_category && ` (catégorie ${driver.license_category})`}</>}
            {driver.phone && <>, joignable au {driver.phone}</>}.
          </p>
        ) : (
          <p>Le véhicule est conduit par le Bénéficiaire, qui déclare être titulaire d'un permis de conduire en cours de validité pour cette catégorie de véhicule.</p>
        )}
      </section>

      <section className="doc-article">
        <h3>Article 4 — Conditions financières</h3>
        <p>
          {invoice
            ? <>La mise à disposition est facturée <strong>{formatMoney(invoice.total)}</strong> selon la facture n° {invoice.number}.</>
            : <>La mise à disposition donne lieu à une facture établie par l'Organisation, payable selon les modalités qu'elle indique.</>}
        </p>
      </section>

      <section className="doc-article">
        <h3>Article 5 — Obligations du Bénéficiaire</h3>
        <ul>
          <li>Utiliser le véhicule uniquement pour la mission et l'itinéraire prévus, et ne pas le sous-louer ni le prêter.</li>
          <li>Respecter le code de la route et ne pas conduire sous l'emprise de l'alcool ou de stupéfiants.</li>
          <li>Veiller au bon état du véhicule et signaler sans délai toute panne, anomalie ou accident à l'Organisation.</li>
          <li>Restituer le véhicule à la date prévue, propre et avec ses documents (carte grise, assurance, contrôle technique).</li>
        </ul>
      </section>

      <section className="doc-article">
        <h3>Article 6 — Responsabilité</h3>
        <p>
          Les amendes et contraventions commises pendant la durée de la mise à disposition sont à la charge du Bénéficiaire.
          En cas de dommage résultant d'une faute, d'une négligence ou d'un usage non conforme au présent contrat, le Bénéficiaire
          répond des réparations dans la limite de ce que l'assurance du véhicule ne couvre pas.
        </p>
      </section>

      <section className="doc-article">
        <h3>Article 7 — Restitution</h3>
        <p>
          À la restitution, le kilométrage et l'état du véhicule sont relevés contradictoirement.
          {r.mileage_end != null && <> Kilométrage constaté au retour : <strong>{formatKm(r.mileage_end)}</strong> ({formatKm(r.mileage_end - r.mileage_start)} parcourus).</>}
        </p>
      </section>

      <p className="doc-lead">
        Fait{org.city ? ` à ${org.city}` : ''}, le {formatDateLong(c.issued_at)}, en deux exemplaires originaux.
        {signed && <> Contrat signé le {formatDateLong(c.signed_at)}.</>}
      </p>

      <DocSignature left="Pour l'Organisation (nom, signature et cachet)" right="Le Bénéficiaire (nom, « lu et approuvé » et signature)" />
    </DocumentPage>
  );
}

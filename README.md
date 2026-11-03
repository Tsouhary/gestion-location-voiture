# Gestion et réservation d'un parc automobile

Application web **React → Node.js/Express → MySQL** : véhicules, conducteurs, réservations avec contrôle des chevauchements, entretiens, **facturation avec reçus de paiement et contrats de mise à disposition**, tableau de bord et alertes.

```
database/schema.sql   Création de la base (16 tables + rôles, catégories, paramètres)
database/migrations/  Mises à jour pour une base existante (001_billing.sql)
backend/              API REST Express 5 (JWT, rôles, validation, tests)
frontend/             Interface React (Vite, React Router, Axios)
```

## Installation

Prérequis : Node.js ≥ 22, MySQL/MariaDB (XAMPP convient).

```bash
# 1. Base de données (MySQL démarré)
mysql -u root < database/schema.sql
#    Base créée avant le module de facturation ? Appliquer une seule fois :
#    mysql -u root parc_auto < database/migrations/001_billing.sql

# 2. API
cd backend
npm install
cp .env.example .env        # puis renseigner DB_PASSWORD et un JWT_SECRET long et aléatoire
npm run seed                # comptes et véhicules de démonstration (facultatif)
npm run dev                 # http://localhost:5000/api

# 3. Interface (autre terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Comptes de démonstration (mot de passe `Parc2026!`) :

| Rôle | Email |
|---|---|
| Administrateur | admin@parc.mg |
| Gestionnaire | gestionnaire@parc.mg |
| Utilisateur | jean.rakoto@parc.mg, lala.rasoa@parc.mg |
| Conducteur | faly.andria@parc.mg |

**Changez ces mots de passe avant tout usage réel.**

## Tests

```bash
cd backend && npm test
```

26 tests d'intégration sur une base dédiée `parc_auto_test` (recréée à chaque exécution, la base principale n'est jamais touchée) : authentification, droits par rôle, validation, workflow de réservation, chevauchements, validations concurrentes, conducteurs, confidentialité, tableau de bord, facturation (montants, paiements partiels, dépassement, numéros de reçu en concurrence), contrats et paramètres.

## Règles métier

- **Créneau occupé** = réservation `validated` ou `in_progress`. Deux périodes se chevauchent si `début_A < fin_B` **et** `fin_A > début_B` ; un départ pile à l'heure de retour d'une autre réservation est autorisé.
- Une demande `pending` ne bloque rien. La **validation** revérifie véhicule et conducteur dans une transaction avec verrou : deux validations simultanées du même véhicule ne peuvent pas réussir toutes les deux.
- Véhicule `maintenance` ou `hors service` : non réservable. Nombre de passagers ≤ nombre de places.
- Conducteur : non `indisponible`, libre sur la période, permis valide jusqu'à la fin de la mission.
- Workflow : `pending → validated → in_progress → completed` ; `rejected` (motif obligatoire) et `cancelled` en sortie.
- Le statut **Réservé** est calculé (réservation validée en cours), il n'est pas stocké. Départ : véhicule `in_mission`, kilométrage de départ relevé. Retour : kilométrage final, véhicule et conducteur libérés.
- Un entretien peut mettre le véhicule en maintenance et met à jour son kilométrage s'il est supérieur.

## Facturation, reçus et contrats

Trois documents imprimables (bouton **Imprimer / PDF** : choisir « Enregistrer au format PDF » dans la fenêtre d'impression du navigateur), avec l'en-tête de votre organisation (à renseigner dans **Paramètres**, administrateur) :

| Document | Numéro | Quand |
|---|---|---|
| **Contrat de mise à disposition** | `CTR-AAAA-0001` | Généré automatiquement à la validation d'une réservation ; marquable « signé » par le personnel |
| **Facture** | `FAC-AAAA-0001` | Créée par le personnel sur une réservation validée (bouton « Créer la facture ») |
| **Reçu de paiement** (pièce justificative) | `REC-AAAA-0001` | Un reçu par paiement enregistré, avec le montant en toutes lettres et le solde restant |

- **Montant** = jours × tarif journalier du véhicule − remise. Les jours sont arrondis à la journée supérieure (34 h → 2 jours, minimum 1). Le tarif se règle dans la fiche du véhicule ; jours, prix et remise restent modifiables sur la facture.
- **Paiements** : partiels acceptés (espèces, mobile money, virement, chèque, carte). Un paiement ne peut pas dépasser le solde restant ; la facture passe « Partiellement payée » puis « Payée ». Le total ne peut pas descendre sous ce qui a déjà été encaissé.
- **Numérotation** continue par année et par type, sans doublon même en cas de saisies simultanées. Un paiement saisi par erreur ne peut être supprimé que par un administrateur (le numéro de reçu supprimé n'est pas réutilisé).
- **Annulation d'une réservation** : sa facture est annulée si aucun paiement n'a été reçu ; sinon elle est conservée et le personnel décide (remboursement hors application).
- Le demandeur voit ses propres factures, reçus et contrat ; le conducteur affecté voit le contrat de sa mission.
- Le texte du contrat est un **modèle général** : à faire relire par un juriste avant usage.

## Rôles

| | Admin | Gestionnaire | Utilisateur | Conducteur |
|---|:-:|:-:|:-:|:-:|
| Utilisateurs | ✔ | | | |
| Véhicules, catégories, conducteurs, entretiens (écriture) | ✔ | ✔ | | |
| Valider / refuser / démarrer / terminer une réservation | ✔ | ✔ | | |
| Voir les véhicules, réserver, gérer ses demandes | ✔ | ✔ | ✔ | |
| Créer factures, encaisser, éditer le contrat | ✔ | ✔ | | |
| Consulter ses factures, reçus et contrats | ✔ | ✔ | ✔ | contrat seul |
| Paramètres de l'organisation, supprimer un paiement | ✔ | | | |
| Voir les missions qui lui sont attribuées | | | | ✔ |

Les droits sont appliqués **par l'API** (l'interface masque seulement les menus). Un utilisateur ne voit que ses propres réservations.

## API

Préfixe `/api`, jeton `Authorization: Bearer <jwt>` sauf pour le login.

| Domaine | Routes |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET/PUT /auth/me` · `PUT /auth/password` |
| Véhicules | `GET /vehicles` (filtres `q`, `category_id`, `status`, `fuel_type`, `brand`) · `GET /vehicles/available?start_at&end_at&seats` · `GET /vehicles/:id` · `GET /vehicles/:id/history` · `POST` · `PUT /:id` · `DELETE /:id` |
| Catégories | `GET/POST /categories` · `PUT/DELETE /categories/:id` |
| Conducteurs | `GET /drivers` · `GET /drivers/available?start_at&end_at` · `GET /drivers/:id/missions` · `POST` · `PUT /:id` · `DELETE /:id` |
| Réservations | `GET/POST /reservations` · `GET/PUT/DELETE /:id` · `PUT /:id/validate` · `/reject` · `/cancel` · `/start` · `/complete` |
| Entretiens | `GET/POST /maintenance` · `GET/PUT/DELETE /maintenance/:id` |
| Utilisateurs | `GET/POST /users` · `GET/PUT/DELETE /users/:id` (admin) |
| Tableau de bord | `GET /dashboard` |
| Facturation | `GET /invoices` · `GET/PUT /invoices/:id` · `POST /reservations/:id/invoice` · `POST /invoices/:id/payments` |
| Reçus | `GET /payments/:id` · `DELETE /payments/:id` (admin) |
| Contrats | `GET/POST /reservations/:id/contract` · `PUT /contracts/:id/sign` |
| Paramètres | `GET /settings` (personnel) · `PUT /settings` (admin) |

Format d'erreur : `{ "message": "…" }` avec 400 (données invalides), 401, 403, 404, 409 (conflit : chevauchement, doublon…).

## Sécurité

Mots de passe hachés (bcrypt), JWT rechargé à chaque requête (un compte désactivé perd l'accès immédiatement), requêtes SQL paramétrées, champs de requête filtrés par liste blanche, `helmet`, limitation des tentatives de connexion (20 / 15 min), message de connexion identique que l'email existe ou non, journal des écritures (`[audit]` en console).

## Écarts par rapport au cahier des charges

- **`bcryptjs`** au lieu de `bcrypt` : même algorithme, sans compilation native (plus simple sous Windows).
- La table `reservation_drivers` n'existe pas : un seul conducteur par réservation, porté par `reservations.driver_id`.
- **Pas encore implémenté** : calendrier (FullCalendar), pannes et réparations, documents (la table `vehicle_repairs`/`vehicle_documents` existe ; les dates d'assurance et de contrôle technique du véhicule alimentent déjà les alertes), notifications (table prête), statistiques détaillées par période, rapports PDF/Excel (les factures, reçus et contrats s'exportent en PDF via l'impression du navigateur), envoi de photo de véhicule, espace conducteur dédié pour signaler un problème.
- Le jeton JWT est conservé dans `localStorage` (simple, mais exposé à un éventuel XSS) ; pour une mise en production, préférer un cookie `httpOnly` et servir l'ensemble en HTTPS.

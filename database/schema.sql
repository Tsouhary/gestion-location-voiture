-- ============================================================
--  Gestion et réservation d'un parc automobile — schéma MySQL
--  Compatible MySQL 8 / MariaDB 10.4+ (XAMPP)
--  Usage : mysql -u root < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS parc_auto
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE parc_auto;

-- ---------- Utilisateurs & rôles ----------

CREATE TABLE IF NOT EXISTS roles (
  id   TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(20) NOT NULL UNIQUE          -- admin | manager | user | driver
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_id       TINYINT UNSIGNED NOT NULL,
  first_name    VARCHAR(80)  NOT NULL,
  last_name     VARCHAR(80)  NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone         VARCHAR(30)  NULL,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ---------- Véhicules ----------

CREATE TABLE IF NOT EXISTS vehicle_categories (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

-- Le statut "Réservé" n'est pas stocké : il est calculé (réservation validée en cours).
CREATE TABLE IF NOT EXISTS vehicles (
  id                          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  category_id                 INT UNSIGNED NULL,
  registration                VARCHAR(20)  NOT NULL UNIQUE,
  brand                       VARCHAR(60)  NOT NULL,
  model                       VARCHAR(60)  NOT NULL,
  year                        SMALLINT UNSIGNED NULL,
  color                       VARCHAR(40)  NULL,
  fuel_type                   ENUM('diesel','essence','hybride','electrique') NOT NULL DEFAULT 'diesel',
  transmission                ENUM('manuelle','automatique') NOT NULL DEFAULT 'manuelle',
  seats                       TINYINT UNSIGNED NOT NULL DEFAULT 5,
  mileage                     INT UNSIGNED NOT NULL DEFAULT 0,
  daily_rate                  DECIMAL(12,2) NOT NULL DEFAULT 0,   -- tarif de location par jour (base de la facturation)
  first_registration_date     DATE NULL,
  insurance_company           VARCHAR(100) NULL,
  insurance_expiry            DATE NULL,
  technical_inspection_expiry DATE NULL,
  status                      ENUM('available','in_mission','maintenance','out_of_service') NOT NULL DEFAULT 'available',
  photo                       VARCHAR(255) NULL,
  description                 TEXT NULL,
  created_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicles_category FOREIGN KEY (category_id) REFERENCES vehicle_categories(id) ON DELETE SET NULL,
  INDEX idx_vehicles_status (status)
) ENGINE=InnoDB;

-- ---------- Conducteurs ----------

CREATE TABLE IF NOT EXISTS drivers (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL UNIQUE,   -- compte de connexion (rôle driver), optionnel
  first_name     VARCHAR(80)  NOT NULL,
  last_name      VARCHAR(80)  NOT NULL,
  phone          VARCHAR(30)  NULL,
  email          VARCHAR(150) NULL,
  address        VARCHAR(255) NULL,
  license_number VARCHAR(40)  NOT NULL UNIQUE,
  license_category VARCHAR(10) NULL,
  license_expiry DATE NOT NULL,
  status         ENUM('available','on_mission','unavailable') NOT NULL DEFAULT 'available',
  hire_date      DATE NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_drivers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Réservations ----------
-- vehicle_id : véhicule souhaité à la demande, puis véhicule affecté à la validation.
-- Seules les réservations 'validated' / 'in_progress' bloquent un créneau.

CREATE TABLE IF NOT EXISTS reservations (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  vehicle_id       INT UNSIGNED NULL,
  driver_id        INT UNSIGNED NULL,
  driver_requested TINYINT(1) NOT NULL DEFAULT 0,
  start_at         DATETIME NOT NULL,
  end_at           DATETIME NOT NULL,
  destination      VARCHAR(150) NOT NULL,
  purpose          VARCHAR(255) NOT NULL,
  passengers       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status           ENUM('pending','validated','rejected','cancelled','in_progress','completed') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  mileage_start    INT UNSIGNED NULL,
  mileage_end      INT UNSIGNED NULL,
  decided_by       INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_res_user    FOREIGN KEY (user_id)    REFERENCES users(id),
  CONSTRAINT fk_res_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  CONSTRAINT fk_res_driver  FOREIGN KEY (driver_id)  REFERENCES drivers(id),
  CONSTRAINT fk_res_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_res_dates  CHECK (end_at > start_at),
  INDEX idx_res_vehicle_period (vehicle_id, status, start_at, end_at),
  INDEX idx_res_driver_period  (driver_id, status, start_at, end_at),
  INDEX idx_res_user (user_id)
) ENGINE=InnoDB;

-- ---------- Entretiens, pannes, documents, kilométrage ----------

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  vehicle_id       INT UNSIGNED NOT NULL,
  type             ENUM('vidange','pneus','freinage','batterie','revision','reparation','controle_technique') NOT NULL,
  maintenance_date DATE NOT NULL,
  mileage          INT UNSIGNED NULL,
  description      TEXT NULL,
  cost             DECIMAL(12,2) NOT NULL DEFAULT 0,
  garage           VARCHAR(120) NULL,
  next_date        DATE NULL,
  next_mileage     INT UNSIGNED NULL,
  created_by       INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_maint_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_maint_user    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_maint_vehicle_date (vehicle_id, maintenance_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_mileage (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  vehicle_id     INT UNSIGNED NOT NULL,
  reservation_id INT UNSIGNED NULL,
  mileage        INT UNSIGNED NOT NULL,
  context        ENUM('reservation_start','reservation_end','maintenance','manual') NOT NULL,
  recorded_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mileage_vehicle FOREIGN KEY (vehicle_id)     REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mileage_res     FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  INDEX idx_mileage_vehicle (vehicle_id, recorded_at)
) ENGINE=InnoDB;

-- Tables prévues pour les modules suivants (pas encore exposées par l'API)

CREATE TABLE IF NOT EXISTS vehicle_repairs (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  vehicle_id     INT UNSIGNED NOT NULL,
  problem        VARCHAR(255) NOT NULL,
  reported_date  DATE NOT NULL,
  status         ENUM('reported','in_repair','repaired') NOT NULL DEFAULT 'reported',
  estimated_cost DECIMAL(12,2) NULL,
  final_cost     DECIMAL(12,2) NULL,
  resolved_date  DATE NULL,
  reported_by    INT UNSIGNED NULL,
  CONSTRAINT fk_repair_vehicle FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_user    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  vehicle_id  INT UNSIGNED NOT NULL,
  type        ENUM('assurance','controle_technique','carte_grise','autre') NOT NULL,
  file_path   VARCHAR(255) NULL,
  expiry_date DATE NULL,
  CONSTRAINT fk_doc_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  message    VARCHAR(255) NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Facturation, paiements, contrats ----------
-- (Bases existantes : appliquer database/migrations/001_billing.sql à la place.)

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

-- Numérotation continue par type de document et par année (FAC-2026-0001, REC-…, CTR-…).
CREATE TABLE IF NOT EXISTS document_sequences (
  kind        ENUM('invoice','receipt','contract') NOT NULL,
  year        SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
) ENGINE=InnoDB;

-- Une facture par réservation. total = max(0, days × unit_price − discount).
CREATE TABLE IF NOT EXISTS invoices (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  number         VARCHAR(20) NOT NULL UNIQUE,
  reservation_id INT UNSIGNED NOT NULL UNIQUE,
  issue_date     DATE NOT NULL,
  days           SMALLINT UNSIGNED NOT NULL,
  unit_price     DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  status         ENUM('unpaid','partial','paid','cancelled') NOT NULL DEFAULT 'unpaid',
  notes          VARCHAR(255) NULL,
  created_by     INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  CONSTRAINT fk_inv_user        FOREIGN KEY (created_by)     REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inv_status (status)
) ENGINE=InnoDB;

-- Chaque paiement porte son propre numéro de reçu (la pièce justificative).
CREATE TABLE IF NOT EXISTS payments (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  receipt_number VARCHAR(20) NOT NULL UNIQUE,
  invoice_id     INT UNSIGNED NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  method         ENUM('especes','mobile_money','virement','cheque','carte') NOT NULL,
  reference      VARCHAR(80) NULL,
  paid_at        DATETIME NOT NULL,
  recorded_by    INT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_invoice FOREIGN KEY (invoice_id)  REFERENCES invoices(id),
  CONSTRAINT fk_pay_user    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_pay_amount CHECK (amount > 0),
  INDEX idx_pay_invoice (invoice_id)
) ENGINE=InnoDB;

-- Contrat de mise à disposition du véhicule : un par réservation validée.
CREATE TABLE IF NOT EXISTS contracts (
  id             INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  number         VARCHAR(20) NOT NULL UNIQUE,
  reservation_id INT UNSIGNED NOT NULL UNIQUE,
  issued_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signed_at      DATETIME NULL,
  created_by     INT UNSIGNED NULL,
  CONSTRAINT fk_ctr_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  CONSTRAINT fk_ctr_user        FOREIGN KEY (created_by)     REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- Données de référence ----------

INSERT IGNORE INTO roles (name) VALUES ('admin'), ('manager'), ('user'), ('driver');

INSERT IGNORE INTO vehicle_categories (name) VALUES
  ('Berline'), ('SUV'), ('4x4'), ('Minibus'), ('Camion'), ('Utilitaire');

-- En-tête des factures, reçus et contrats (modifiable par l'administrateur dans l'application).
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('org_name', 'Mon organisation'),
  ('org_address', ''),
  ('org_city', ''),
  ('org_phone', ''),
  ('org_email', ''),
  ('org_nif', ''),
  ('org_stat', '');

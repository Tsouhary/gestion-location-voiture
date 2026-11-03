-- Migration 001 : facturation, paiements, contrats.
-- À appliquer UNE SEULE FOIS sur une base créée avant l'ajout de ce module :
--   mysql -u root parc_auto < database/migrations/001_billing.sql
-- (Une nouvelle installation utilise directement database/schema.sql, qui l'inclut déjà.)

USE parc_auto;

ALTER TABLE vehicles ADD COLUMN daily_rate DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER mileage;

CREATE TABLE IF NOT EXISTS settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS document_sequences (
  kind        ENUM('invoice','receipt','contract') NOT NULL,
  year        SMALLINT UNSIGNED NOT NULL,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
) ENGINE=InnoDB;

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

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
  ('org_name', 'Mon organisation'), ('org_address', ''), ('org_city', ''),
  ('org_phone', ''), ('org_email', ''), ('org_nif', ''), ('org_stat', '');

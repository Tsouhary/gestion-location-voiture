-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: parc_auto
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `parc_auto`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `parc_auto` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `parc_auto`;

--
-- Table structure for table `contracts`
--

DROP TABLE IF EXISTS `contracts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contracts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `number` varchar(20) NOT NULL,
  `reservation_id` int(10) unsigned NOT NULL,
  `issued_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `signed_at` datetime DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `number` (`number`),
  UNIQUE KEY `reservation_id` (`reservation_id`),
  KEY `fk_ctr_user` (`created_by`),
  CONSTRAINT `fk_ctr_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_ctr_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `contracts`
--

LOCK TABLES `contracts` WRITE;
/*!40000 ALTER TABLE `contracts` DISABLE KEYS */;
INSERT INTO `contracts` VALUES (1,'CTR-2026-0001',1,'2026-09-20 20:43:24','2026-09-09 23:43:24',2),(2,'CTR-2026-0002',2,'2026-09-20 20:43:24','2026-11-03 13:16:50',2),(3,'CTR-2026-0003',3,'2026-09-21 12:58:39',NULL,6),(4,'CTR-2026-0004',6,'2026-09-21 16:36:06','2026-09-21 19:36:57',6),(5,'CTR-2026-0005',7,'2026-09-22 07:52:02',NULL,6);
/*!40000 ALTER TABLE `contracts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_sequences`
--

DROP TABLE IF EXISTS `document_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `document_sequences` (
  `kind` enum('invoice','receipt','contract') NOT NULL,
  `year` smallint(5) unsigned NOT NULL,
  `last_number` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`kind`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_sequences`
--

LOCK TABLES `document_sequences` WRITE;
/*!40000 ALTER TABLE `document_sequences` DISABLE KEYS */;
INSERT INTO `document_sequences` VALUES ('invoice',2026,4),('receipt',2026,4),('contract',2026,5);
/*!40000 ALTER TABLE `document_sequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `drivers`
--

DROP TABLE IF EXISTS `drivers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `drivers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `license_number` varchar(40) NOT NULL,
  `license_category` varchar(10) DEFAULT NULL,
  `license_expiry` date NOT NULL,
  `status` enum('available','on_mission','unavailable') NOT NULL DEFAULT 'available',
  `hire_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `license_number` (`license_number`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_drivers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `drivers`
--

LOCK TABLES `drivers` WRITE;
/*!40000 ALTER TABLE `drivers` DISABLE KEYS */;
INSERT INTO `drivers` VALUES (1,5,'Faly','Andria','034 00 000 01',NULL,NULL,'MG-001-2019','B','2027-10-25','available','2019-03-01','2026-09-20 20:03:17','2026-09-20 20:03:17'),(2,NULL,'Rija','Rabe','034 00 000 02',NULL,NULL,'MG-002-2020','C','2026-10-15','available','2020-06-15','2026-09-20 20:03:17','2026-09-21 15:42:52'),(3,NULL,'Toky','Razafy','034 00 000 03',NULL,NULL,'MG-003-2021','D','2028-08-20','on_mission','2021-09-10','2026-09-20 20:03:17','2026-11-03 10:16:32');
/*!40000 ALTER TABLE `drivers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `number` varchar(20) NOT NULL,
  `reservation_id` int(10) unsigned NOT NULL,
  `issue_date` date NOT NULL,
  `days` smallint(5) unsigned NOT NULL,
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('unpaid','partial','paid','cancelled') NOT NULL DEFAULT 'unpaid',
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `number` (`number`),
  UNIQUE KEY `reservation_id` (`reservation_id`),
  KEY `fk_inv_user` (`created_by`),
  KEY `idx_inv_status` (`status`),
  CONSTRAINT `fk_inv_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`),
  CONSTRAINT `fk_inv_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES (1,'FAC-2026-0001',1,'2026-09-20',2,250000.00,0.00,500000.00,'paid',NULL,2,'2026-09-20 20:43:24'),(2,'FAC-2026-0002',2,'2026-09-20',2,200000.00,0.00,400000.00,'partial',NULL,2,'2026-09-20 20:43:24'),(3,'FAC-2026-0003',6,'2026-09-21',4,400000.00,0.00,1600000.00,'paid',NULL,6,'2026-09-21 16:37:06'),(4,'FAC-2026-0004',7,'2026-11-03',2,350000.00,0.00,700000.00,'unpaid',NULL,6,'2026-11-03 10:17:21');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `message` varchar(255) NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_notif_user` (`user_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `receipt_number` varchar(20) NOT NULL,
  `invoice_id` int(10) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `method` enum('especes','mobile_money','virement','cheque','carte') NOT NULL,
  `reference` varchar(80) DEFAULT NULL,
  `paid_at` datetime NOT NULL,
  `recorded_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `receipt_number` (`receipt_number`),
  KEY `fk_pay_user` (`recorded_by`),
  KEY `idx_pay_invoice` (`invoice_id`),
  CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`),
  CONSTRAINT `fk_pay_user` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_pay_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (1,'REC-2026-0001',1,250000.00,'mobile_money','MVola 034 12 345 67','2026-09-10 23:43:24',2,'2026-09-20 20:43:24'),(2,'REC-2026-0002',1,250000.00,'especes',NULL,'2026-09-12 23:43:24',2,'2026-09-20 20:43:24'),(3,'REC-2026-0003',2,100000.00,'mobile_money','MVola 034 98 765 43','2026-09-19 23:43:24',2,'2026-09-20 20:43:24'),(5,'REC-2026-0004',3,1600000.00,'especes',NULL,'2026-09-21 19:38:00',6,'2026-09-21 16:38:26');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reservations`
--

DROP TABLE IF EXISTS `reservations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reservations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `vehicle_id` int(10) unsigned DEFAULT NULL,
  `driver_id` int(10) unsigned DEFAULT NULL,
  `driver_requested` tinyint(1) NOT NULL DEFAULT 0,
  `start_at` datetime NOT NULL,
  `end_at` datetime NOT NULL,
  `destination` varchar(150) NOT NULL,
  `purpose` varchar(255) NOT NULL,
  `passengers` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `status` enum('pending','validated','rejected','cancelled','in_progress','completed') NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(255) DEFAULT NULL,
  `mileage_start` int(10) unsigned DEFAULT NULL,
  `mileage_end` int(10) unsigned DEFAULT NULL,
  `decided_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_res_decider` (`decided_by`),
  KEY `idx_res_vehicle_period` (`vehicle_id`,`status`,`start_at`,`end_at`),
  KEY `idx_res_driver_period` (`driver_id`,`status`,`start_at`,`end_at`),
  KEY `idx_res_user` (`user_id`),
  CONSTRAINT `fk_res_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_res_driver` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`),
  CONSTRAINT `fk_res_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_res_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`),
  CONSTRAINT `chk_res_dates` CHECK (`end_at` > `start_at`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reservations`
--

LOCK TABLES `reservations` WRITE;
/*!40000 ALTER TABLE `reservations` DISABLE KEYS */;
INSERT INTO `reservations` VALUES (1,3,1,2,1,'2026-09-10 08:00:00','2026-09-11 18:00:00','Antsirabe','Visite de chantier',3,'completed',NULL,47750,48200,2,'2026-09-20 20:20:42','2026-09-20 20:20:42'),(2,4,3,3,1,'2026-09-23 08:00:00','2026-09-24 17:00:00','Toamasina','Réunion avec un partenaire',2,'in_progress',NULL,21500,NULL,2,'2026-09-20 20:20:42','2026-11-03 10:16:32'),(3,3,5,2,0,'2026-09-27 07:30:00','2026-09-27 17:30:00','Mahajanga','Livraison de matériel',1,'completed',NULL,134800,434800,6,'2026-09-20 20:20:42','2026-09-21 15:42:52'),(4,4,4,NULL,0,'2026-09-25 06:00:00','2026-09-26 20:00:00','Fianarantsoa','Sortie d\'équipe',10,'rejected','Véhicule déjà prévu pour une autre mission',NULL,NULL,2,'2026-09-20 20:20:42','2026-09-20 20:20:42'),(6,6,2,NULL,0,'2026-09-22 19:34:00','2026-09-26 19:34:00','Manakara','Mission',4,'validated',NULL,NULL,NULL,6,'2026-09-21 16:35:28','2026-09-21 16:36:06'),(7,6,6,2,1,'2026-09-23 10:50:00','2026-09-25 10:50:00','Mahajanga','Vacance',2,'validated',NULL,NULL,NULL,6,'2026-09-22 07:51:45','2026-09-22 07:52:02');
/*!40000 ALTER TABLE `reservations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(4,'driver'),(2,'manager'),(3,'user');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES ('org_address','Lot II A 45, Analakely'),('org_city','Antananarivo'),('org_email','contact@parc.mg'),('org_name','Société Malagasy de Transport'),('org_nif','1000000000'),('org_phone','020 22 000 00'),('org_stat','49100 11 2020 0 00001');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` tinyint(3) unsigned NOT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(100) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_users_role` (`role_id`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'Admin','Système','admin@parc.mg','$2b$10$mnbpzm5L30EVeaxkVFI0meV0SklsUk96QWn7a7SgedrMnwG3TTJCq',NULL,1,'2026-09-20 20:03:17','2026-09-20 20:03:17'),(2,2,'Hery','Randria','gestionnaire@parc.mg','$2b$10$mnbpzm5L30EVeaxkVFI0meV0SklsUk96QWn7a7SgedrMnwG3TTJCq',NULL,1,'2026-09-20 20:03:17','2026-09-20 20:03:17'),(3,3,'Jean','Rakoto','jean.rakoto@parc.mg','$2b$10$mnbpzm5L30EVeaxkVFI0meV0SklsUk96QWn7a7SgedrMnwG3TTJCq',NULL,1,'2026-09-20 20:03:17','2026-09-20 20:03:17'),(4,3,'Lala','Rasoa','lala.rasoa@parc.mg','$2b$10$mnbpzm5L30EVeaxkVFI0meV0SklsUk96QWn7a7SgedrMnwG3TTJCq',NULL,1,'2026-09-20 20:03:17','2026-09-20 20:03:17'),(5,4,'Faly','Andria','faly.andria@parc.mg','$2b$10$mnbpzm5L30EVeaxkVFI0meV0SklsUk96QWn7a7SgedrMnwG3TTJCq',NULL,1,'2026-09-20 20:03:17','2026-09-20 20:03:17'),(6,1,'Tsou','ANDRIANIRINA','tsou@parc.mg','$2b$10$FYzIF/7RmcWyPmN1cah71uxpF0Sg9U/IyNBUYjoixa.okksB670rG',NULL,1,'2026-09-20 20:20:42','2026-09-23 08:29:45');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_categories`
--

DROP TABLE IF EXISTS `vehicle_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicle_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_categories`
--

LOCK TABLES `vehicle_categories` WRITE;
/*!40000 ALTER TABLE `vehicle_categories` DISABLE KEYS */;
INSERT INTO `vehicle_categories` VALUES (1,'Berline',NULL),(2,'SUV',NULL),(3,'4x4',NULL),(4,'Minibus',NULL),(5,'Camion',NULL),(6,'Utilitaire',NULL);
/*!40000 ALTER TABLE `vehicle_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_documents`
--

DROP TABLE IF EXISTS `vehicle_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicle_documents` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_id` int(10) unsigned NOT NULL,
  `type` enum('assurance','controle_technique','carte_grise','autre') NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_doc_vehicle` (`vehicle_id`),
  CONSTRAINT `fk_doc_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_documents`
--

LOCK TABLES `vehicle_documents` WRITE;
/*!40000 ALTER TABLE `vehicle_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_maintenance`
--

DROP TABLE IF EXISTS `vehicle_maintenance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicle_maintenance` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_id` int(10) unsigned NOT NULL,
  `type` enum('vidange','pneus','freinage','batterie','revision','reparation','controle_technique') NOT NULL,
  `maintenance_date` date NOT NULL,
  `mileage` int(10) unsigned DEFAULT NULL,
  `description` text DEFAULT NULL,
  `cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `garage` varchar(120) DEFAULT NULL,
  `next_date` date DEFAULT NULL,
  `next_mileage` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_maint_user` (`created_by`),
  KEY `idx_maint_vehicle_date` (`vehicle_id`,`maintenance_date`),
  CONSTRAINT `fk_maint_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_maint_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_maintenance`
--

LOCK TABLES `vehicle_maintenance` WRITE;
/*!40000 ALTER TABLE `vehicle_maintenance` DISABLE KEYS */;
INSERT INTO `vehicle_maintenance` VALUES (1,1,'vidange','2026-07-22',47000,NULL,180000.00,'Garage Central','2026-10-10',57000,2,'2026-09-20 20:03:17'),(2,3,'vidange','2026-09-22',NULL,NULL,200000.00,'Ampefy','2026-12-21',NULL,6,'2026-09-21 16:40:07');
/*!40000 ALTER TABLE `vehicle_maintenance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_mileage`
--

DROP TABLE IF EXISTS `vehicle_mileage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicle_mileage` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_id` int(10) unsigned NOT NULL,
  `reservation_id` int(10) unsigned DEFAULT NULL,
  `mileage` int(10) unsigned NOT NULL,
  `context` enum('reservation_start','reservation_end','maintenance','manual') NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_mileage_res` (`reservation_id`),
  KEY `idx_mileage_vehicle` (`vehicle_id`,`recorded_at`),
  CONSTRAINT `fk_mileage_res` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mileage_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_mileage`
--

LOCK TABLES `vehicle_mileage` WRITE;
/*!40000 ALTER TABLE `vehicle_mileage` DISABLE KEYS */;
INSERT INTO `vehicle_mileage` VALUES (1,1,1,47750,'reservation_start','2026-09-20 20:20:42'),(2,1,1,48200,'reservation_end','2026-09-20 20:20:42'),(3,5,3,134800,'reservation_start','2026-09-21 15:42:27'),(4,5,3,434800,'reservation_end','2026-09-21 15:42:52'),(5,3,2,21500,'reservation_start','2026-11-03 10:16:32');
/*!40000 ALTER TABLE `vehicle_mileage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicle_repairs`
--

DROP TABLE IF EXISTS `vehicle_repairs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicle_repairs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vehicle_id` int(10) unsigned NOT NULL,
  `problem` varchar(255) NOT NULL,
  `reported_date` date NOT NULL,
  `status` enum('reported','in_repair','repaired') NOT NULL DEFAULT 'reported',
  `estimated_cost` decimal(12,2) DEFAULT NULL,
  `final_cost` decimal(12,2) DEFAULT NULL,
  `resolved_date` date DEFAULT NULL,
  `reported_by` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_repair_vehicle` (`vehicle_id`),
  KEY `fk_repair_user` (`reported_by`),
  CONSTRAINT `fk_repair_user` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_repair_vehicle` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicle_repairs`
--

LOCK TABLES `vehicle_repairs` WRITE;
/*!40000 ALTER TABLE `vehicle_repairs` DISABLE KEYS */;
/*!40000 ALTER TABLE `vehicle_repairs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vehicles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int(10) unsigned DEFAULT NULL,
  `registration` varchar(20) NOT NULL,
  `brand` varchar(60) NOT NULL,
  `model` varchar(60) NOT NULL,
  `year` smallint(5) unsigned DEFAULT NULL,
  `color` varchar(40) DEFAULT NULL,
  `fuel_type` enum('diesel','essence','hybride','electrique') NOT NULL DEFAULT 'diesel',
  `transmission` enum('manuelle','automatique') NOT NULL DEFAULT 'manuelle',
  `seats` tinyint(3) unsigned NOT NULL DEFAULT 5,
  `mileage` int(10) unsigned NOT NULL DEFAULT 0,
  `daily_rate` decimal(12,2) NOT NULL DEFAULT 0.00,
  `first_registration_date` date DEFAULT NULL,
  `insurance_company` varchar(100) DEFAULT NULL,
  `insurance_expiry` date DEFAULT NULL,
  `technical_inspection_expiry` date DEFAULT NULL,
  `status` enum('available','in_mission','maintenance','out_of_service') NOT NULL DEFAULT 'available',
  `photo` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `registration` (`registration`),
  KEY `fk_vehicles_category` (`category_id`),
  KEY `idx_vehicles_status` (`status`),
  CONSTRAINT `fk_vehicles_category` FOREIGN KEY (`category_id`) REFERENCES `vehicle_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
INSERT INTO `vehicles` VALUES (1,3,'1234 TBA','Toyota','Hilux',2022,'Blanc','diesel','manuelle',5,48200,250000.00,NULL,NULL,'2027-04-08','2027-02-17','available',NULL,NULL,'2026-09-20 20:03:17','2026-09-20 20:43:24'),(2,1,'5678 TBC','Toyota','Corolla',2021,'Gris','essence','automatique',5,62100,150000.00,NULL,NULL,'2026-10-02','2026-12-19','available',NULL,NULL,'2026-09-20 20:03:17','2026-09-20 20:43:24'),(3,2,'2468 TAB','Hyundai','Tucson',2023,'Noir','diesel','automatique',5,21500,200000.00,NULL,NULL,'2027-07-17','2026-10-10','in_mission',NULL,NULL,'2026-09-20 20:03:17','2026-11-03 10:16:32'),(4,4,'1357 TAC','Toyota','Hiace',2020,'Blanc','diesel','manuelle',14,97300,300000.00,NULL,NULL,'2027-01-18','2026-11-19','available',NULL,NULL,'2026-09-20 20:03:17','2026-09-20 20:43:24'),(5,6,'9753 TBD','Renault','Kangoo',2019,'Bleu','diesel','manuelle',3,434800,120000.00,NULL,NULL,'2026-11-04','2026-09-15','available',NULL,NULL,'2026-09-20 20:03:17','2026-09-21 15:42:52'),(6,5,'8642 TAD','Isuzu','NPR',2018,'Blanc','diesel','manuelle',3,210400,350000.00,NULL,NULL,'2026-12-19','2026-12-04','available',NULL,NULL,'2026-09-20 20:03:17','2026-09-20 20:43:24');
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'parc_auto'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-03 13:35:42

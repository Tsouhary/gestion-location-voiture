import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize, ROLES, STAFF } from '../middlewares/auth.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as categories from '../controllers/categoryController.js';
import * as vehicles from '../controllers/vehicleController.js';
import * as drivers from '../controllers/driverController.js';
import * as reservations from '../controllers/reservationController.js';
import * as maintenance from '../controllers/maintenanceController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as billing from '../controllers/billingController.js';
import * as settings from '../controllers/settingsController.js';

const router = Router();
const staff = authorize(...STAFF);

// --- Authentification ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion, réessayez dans quelques minutes' },
});
router.post('/auth/login', loginLimiter, auth.login);

// Tout ce qui suit exige un jeton valide.
router.use(authenticate);

router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);
router.put('/auth/me', auth.updateProfile);
router.put('/auth/password', auth.changePassword);

router.get('/dashboard', dashboard.stats);

// --- Utilisateurs (administrateur) ---
router.use('/users', authorize(ROLES.ADMIN));
router.get('/users', users.list);
router.post('/users', users.create);
router.get('/users/:id', users.getOne);
router.put('/users/:id', users.update);
router.delete('/users/:id', users.remove);

// --- Catégories ---
router.get('/categories', categories.list);
router.post('/categories', staff, categories.create);
router.put('/categories/:id', staff, categories.update);
router.delete('/categories/:id', staff, categories.remove);

// --- Véhicules ---
router.get('/vehicles', vehicles.list);
router.get('/vehicles/available', vehicles.available); // avant /:id
router.get('/vehicles/:id', vehicles.getOne);
router.get('/vehicles/:id/history', staff, vehicles.history);
router.post('/vehicles', staff, vehicles.create);
router.put('/vehicles/:id', staff, vehicles.update);
router.delete('/vehicles/:id', staff, vehicles.remove);

// --- Conducteurs (données personnelles : personnel uniquement) ---
router.use('/drivers', staff);
router.get('/drivers', drivers.list);
router.get('/drivers/available', drivers.available); // avant /:id
router.get('/drivers/:id', drivers.getOne);
router.get('/drivers/:id/missions', drivers.missions);
router.post('/drivers', drivers.create);
router.put('/drivers/:id', drivers.update);
router.delete('/drivers/:id', drivers.remove);

// --- Réservations (droits fins gérés dans le contrôleur : propriétaire / conducteur affecté / personnel) ---
router.get('/reservations', reservations.list);
router.post('/reservations', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.USER), reservations.create);
router.get('/reservations/:id', reservations.getOne);
router.put('/reservations/:id', reservations.update);
router.delete('/reservations/:id', reservations.remove);
router.put('/reservations/:id/validate', staff, reservations.validate);
router.put('/reservations/:id/reject', staff, reservations.reject);
router.put('/reservations/:id/cancel', reservations.cancel);
router.put('/reservations/:id/start', staff, reservations.start);
router.put('/reservations/:id/complete', staff, reservations.complete);

// --- Facturation : personnel (tout) ou demandeur (ses propres factures) ; le conducteur n'y a pas accès ---
const billable = authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.USER);
router.get('/invoices', billable, billing.listInvoices);
router.get('/invoices/:id', billable, billing.getInvoice);
router.put('/invoices/:id', staff, billing.updateInvoice);
router.post('/invoices/:id/payments', staff, billing.addPayment);
router.post('/reservations/:id/invoice', staff, billing.createInvoiceForReservation);
router.get('/payments/:id', billable, billing.getReceipt);
router.delete('/payments/:id', authorize(ROLES.ADMIN), billing.deletePayment);

// --- Contrats (le conducteur affecté peut consulter le contrat de sa mission) ---
router.get('/reservations/:id/contract', billing.getContract);
router.post('/reservations/:id/contract', staff, billing.createContract);
router.put('/contracts/:id/sign', staff, billing.signContract);

// --- Paramètres de l'organisation (en-tête des documents) ---
router.get('/settings', staff, settings.get);
router.put('/settings', authorize(ROLES.ADMIN), settings.update);

// --- Entretiens ---
router.use('/maintenance', staff);
router.get('/maintenance', maintenance.list);
router.get('/maintenance/:id', maintenance.getOne);
router.post('/maintenance', maintenance.create);
router.put('/maintenance/:id', maintenance.update);
router.delete('/maintenance/:id', maintenance.remove);

export default router;

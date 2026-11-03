import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { auditLog } from './middlewares/audit.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
  throw new Error('JWT_SECRET manquant ou non modifié : configurez backend/.env');
}

const app = express();

app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '100kb' }));
app.use(auditLog);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

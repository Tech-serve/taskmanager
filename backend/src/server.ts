import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import boardRoutes from './routes/boards';
import columnRoutes from './routes/columns';
import taskRoutes from './routes/tasks';
import adminRoutes from './routes/admin';
import adminRolesRoutes from './routes/adminRoles';
import departmentsRouter from './routes/departments';
import expensesRoutes from './routes/expenses';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);

// Security middleware
app.use(helmet());

// ----------- CORS (строго по .env, без '*') -----------
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  envOrigins.length ? envOrigins : ['http://localhost:3000', 'http://127.0.0.1:3000']
);

// чтобы кеш не ломал Origin-варьирование
app.use((req, res, next) => {
  res.setHeader('Vary', 'Origin');
  next();
});

const corsOrigin = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
  // Разрешаем инструменты без Origin (curl/Postman)
  if (!origin) return cb(null, true);
  if (allowedOrigins.has(origin)) return cb(null, true);
  return cb(new Error('CORS: origin not allowed'));
};

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length'],
  })
);

// Preflight явный (некоторые прокси это любят)
app.options('*', cors({ origin: corsOrigin, credentials: true }));
// ------------------------------------------------------

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB();

/** ===================== API Routes ===================== */
app.use('/api/auth', authRoutes);

app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/boards', authMiddleware, boardRoutes);
app.use('/api/columns', authMiddleware, columnRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);

// Общие админские (если есть)
app.use('/api/admin', authMiddleware, adminRoutes);

// Роли
app.use('/api/admin/roles', authMiddleware, adminRolesRoutes);

// Департаменты (правила — внутри роутера)
app.use('/api/admin/departments', departmentsRouter);
/** ====================================================== */

app.use('/api/expenses', authMiddleware, expensesRoutes);
// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware, requireAdmin } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import boardRoutes from './routes/boards';
import columnRoutes from './routes/columns';
import taskRoutes from './routes/tasks';
import adminRoutes from './routes/admin';
import adminRolesRoutes from './routes/adminRoles';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8001', 10);

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to database
connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/boards', authMiddleware, boardRoutes);
app.use('/api/columns', authMiddleware, columnRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/admin', authMiddleware, adminRoutes); 
app.use('/api/admin/roles', authMiddleware, requireAdmin, adminRolesRoutes);

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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import interviewRoutes from './routes/interview.routes.js';
import resumeRoutes from './routes/resume.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import { globalErrorHandler } from './middleware/error.middleware.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', process.env.FRONTEND_URL || ''] }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/interviews', interviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});

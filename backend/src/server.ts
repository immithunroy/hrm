import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { errorHandler, notFound } from './utils/appError';
import authRoutes from './routes/auth.routes';
import employeeRoutes from './routes/employee.routes';
import attendanceRoutes from './routes/attendance.routes';
import payrollRoutes from './routes/payroll.routes';
import recruitmentRoutes from './routes/recruitment.routes';
import shiftRoutes from './routes/shift.routes';
import leaveRoutes from './routes/leave.routes';
import deviceRoutes from './routes/device.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import settingsRoutes from './routes/settings.routes';
import holidayRoutes from './routes/holiday.routes';
import loanRoutes from './routes/loan.routes';
import festivalBonusRoutes from './routes/festivalBonus.routes';
import { connectZKTDevice } from './services/zktService';
import { syncGoogleBangladeshHolidays } from './services/holiday.service';
import { prisma } from './config/database';

// Load environment variables
dotenv.config();

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Uploaded files (recruitment CVs, profile images) served under /api/uploads.
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/api/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'HRM & Payroll'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/festival-bonuses', festivalBonusRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`User ${socket.id} left room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  // Connect to ZKT device (non-fatal - server starts even if device is offline)
  connectZKTDevice(io)
    .then(() => console.log('✅ ZKT device connection initialized'))
    .catch((error) => {
      console.error('⚠️ ZKT device connection failed (will retry in background):', error);
    });

  // Best-effort sync of Google Bangladesh holidays on startup (non-fatal).
  syncGoogleBangladeshHolidays()
    .then((r) => console.log(`🗓️ Google BD holidays synced: ${r.created} new, ${r.skipped} existing`))
    .catch((error) => console.error('⚠️ Google BD holiday sync failed:', error));

  // Re-sync Google BD holidays once per day.
  setInterval(() => {
    syncGoogleBangladeshHolidays().catch((error) =>
      console.error('⚠️ Scheduled Google BD holiday sync failed:', error)
    );
  }, 24 * 60 * 60 * 1000);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket available at ws://localhost:${PORT}`);
  });
};

startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT. Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM. Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});

export default app;
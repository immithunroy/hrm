"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const appError_1 = require("./utils/appError");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const employee_routes_1 = __importDefault(require("./routes/employee.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const payroll_routes_1 = __importDefault(require("./routes/payroll.routes"));
const recruitment_routes_1 = __importDefault(require("./routes/recruitment.routes"));
const shift_routes_1 = __importDefault(require("./routes/shift.routes"));
const leave_routes_1 = __importDefault(require("./routes/leave.routes"));
const device_routes_1 = __importDefault(require("./routes/device.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const holiday_routes_1 = __importDefault(require("./routes/holiday.routes"));
const loan_routes_1 = __importDefault(require("./routes/loan.routes"));
const festivalBonus_routes_1 = __importDefault(require("./routes/festivalBonus.routes"));
const zktService_1 = require("./services/zktService");
const holiday_service_1 = require("./services/holiday.service");
const database_1 = require("./config/database");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
app.set('trust proxy', true);
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});
// Middleware
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Uploaded files (recruitment CVs, profile images) served under /api/uploads.
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
fs_1.default.mkdirSync(uploadsDir, { recursive: true });
app.use('/api/uploads', express_1.default.static(uploadsDir));
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'ZKT Payroll HR System'
    });
});
// API routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/employees', employee_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/payroll', payroll_routes_1.default);
app.use('/api/recruitment', recruitment_routes_1.default);
app.use('/api/shifts', shift_routes_1.default);
app.use('/api/leave', leave_routes_1.default);
app.use('/api/devices', device_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/holidays', holiday_routes_1.default);
app.use('/api/loans', loan_routes_1.default);
app.use('/api/festival-bonuses', festivalBonus_routes_1.default);
// 404 handler
app.use(appError_1.notFound);
// Error handler
app.use(appError_1.errorHandler);
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
        await database_1.prisma.$connect();
        console.log('✅ Database connected successfully');
    }
    catch (error) {
        console.error('❌ Failed to connect to database:', error);
        process.exit(1);
    }
    // Connect to ZKT device (non-fatal - server starts even if device is offline)
    (0, zktService_1.connectZKTDevice)(io)
        .then(() => console.log('✅ ZKT device connection initialized'))
        .catch((error) => {
        console.error('⚠️ ZKT device connection failed (will retry in background):', error);
    });
    // Best-effort sync of Google Bangladesh holidays on startup (non-fatal).
    (0, holiday_service_1.syncGoogleBangladeshHolidays)()
        .then((r) => console.log(`🗓️ Google BD holidays synced: ${r.created} new, ${r.skipped} existing`))
        .catch((error) => console.error('⚠️ Google BD holiday sync failed:', error));
    // Re-sync Google BD holidays once per day.
    setInterval(() => {
        (0, holiday_service_1.syncGoogleBangladeshHolidays)().catch((error) => console.error('⚠️ Scheduled Google BD holiday sync failed:', error));
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
    await database_1.prisma.$disconnect();
    server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
    });
});
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    await database_1.prisma.$disconnect();
    server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
    });
});
exports.default = app;

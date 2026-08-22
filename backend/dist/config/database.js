"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Prisma Client Instance — log queries only in development
const logConfig = process.env.NODE_ENV === 'production'
    ? [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ]
    : [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ];
exports.prisma = new client_1.PrismaClient({ log: logConfig });
// Log queries only in development (never log params which may contain password hashes)
if (process.env.NODE_ENV !== 'production') {
    exports.prisma.$on('query', (e) => {
        console.log('Query: ' + e.query);
        console.log('Duration: ' + e.duration + 'ms');
    });
}
// Export for use in other files
exports.default = exports.prisma;

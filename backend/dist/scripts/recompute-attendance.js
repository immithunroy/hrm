"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("../config/database");
const zktService_1 = require("../services/zktService");
dotenv_1.default.config();
async function main() {
    await database_1.prisma.$connect();
    const result = await (0, zktService_1.recomputeAllAttendance)();
    console.log(`Recomputed ${result.updated}/${result.total} attendance records`);
}
main()
    .catch((err) => { console.error('Recompute failed:', err); process.exit(1); })
    .finally(() => database_1.prisma.$disconnect());

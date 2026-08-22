"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateShiftAssignmentSchema = exports.shiftAssignmentSchema = exports.updateShiftSchema = exports.shiftSchema = void 0;
const zod_1 = require("zod");
exports.shiftSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Shift name is required'),
    description: zod_1.z.string().optional(),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format'),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format'),
    breakTime: zod_1.z.number().int().min(0, 'Break time must be non-negative').optional().default(0),
    isActive: zod_1.z.boolean().optional().default(true)
});
exports.updateShiftSchema = exports.shiftSchema.partial();
exports.shiftAssignmentSchema = zod_1.z.object({
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    shiftId: zod_1.z.string().min(1, 'Shift ID is required'),
    date: zod_1.z.string().date(),
    notes: zod_1.z.string().optional()
});
exports.updateShiftAssignmentSchema = exports.shiftAssignmentSchema.partial().extend({
    id: zod_1.z.string().min(1, 'Assignment ID is required')
});
exports.default = {
    shiftSchema: exports.shiftSchema,
    updateShiftSchema: exports.updateShiftSchema,
    shiftAssignmentSchema: exports.shiftAssignmentSchema,
    updateShiftAssignmentSchema: exports.updateShiftAssignmentSchema
};

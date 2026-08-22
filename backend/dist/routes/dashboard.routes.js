"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const authenticateToken_1 = require("../middleware/authenticateToken");
const router = (0, express_1.Router)();
router.use(authenticateToken_1.authenticateToken);
router.get('/', (0, authenticateToken_1.authorize)('ADMIN', 'MANAGER', 'HR', 'EMPLOYEE'), dashboard_controller_1.getDashboard);
exports.default = router;

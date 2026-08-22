"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = void 0;
const settings_service_1 = require("../services/settings.service");
const getSettings = async (req, res, next) => {
    try {
        const settings = await (0, settings_service_1.getPayrollSettings)();
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res, next) => {
    try {
        const settings = await (0, settings_service_1.updatePayrollSettings)(req.body);
        res.status(200).json({ success: true, data: settings });
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettings = updateSettings;
exports.default = { getSettings: exports.getSettings, updateSettings: exports.updateSettings };

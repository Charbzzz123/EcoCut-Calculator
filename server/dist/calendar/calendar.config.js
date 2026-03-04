"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCalendarConfig = loadCalendarConfig;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function readCredentialsFromEnv() {
    if (process.env.GOOGLE_CALENDAR_CREDENTIALS) {
        return process.env.GOOGLE_CALENDAR_CREDENTIALS;
    }
    const filePath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH;
    if (filePath) {
        return (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(filePath), 'utf8');
    }
    return undefined;
}
function loadCalendarConfig() {
    const rawCredentials = readCredentialsFromEnv();
    if (!rawCredentials) {
        throw new Error('Google Calendar credentials missing. Provide GOOGLE_CALENDAR_CREDENTIALS (JSON string) or GOOGLE_CALENDAR_CREDENTIALS_PATH (file path).');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawCredentials);
    }
    catch {
        throw new Error('Unable to parse Google Calendar credentials JSON.');
    }
    if (!isServiceAccountCredentials(parsed)) {
        throw new Error('Google Calendar credentials must include client_email and private_key.');
    }
    return {
        credentials: {
            client_email: parsed.client_email,
            private_key: parsed.private_key,
        },
        calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'ecojcut@gmail.com',
    };
}
function isServiceAccountCredentials(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value;
    return (typeof candidate.client_email === 'string' &&
        typeof candidate.private_key === 'string');
}
//# sourceMappingURL=calendar.config.js.map
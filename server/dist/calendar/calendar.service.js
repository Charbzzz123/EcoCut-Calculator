"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CalendarService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarService = void 0;
const common_1 = require("@nestjs/common");
const googleapis_1 = require("googleapis");
const calendar_config_js_1 = require("./calendar.config.js");
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];
let CalendarService = CalendarService_1 = class CalendarService {
    logger = new common_1.Logger(CalendarService_1.name);
    calendarId;
    calendar;
    constructor() {
        try {
            const config = (0, calendar_config_js_1.loadCalendarConfig)();
            this.calendarId = config.calendarId;
            const privateKey = config.credentials.private_key.replace(/\\n/g, '\n');
            const auth = new googleapis_1.google.auth.JWT({
                email: config.credentials.client_email,
                key: privateKey,
                scopes: CALENDAR_SCOPES,
            });
            this.calendar = googleapis_1.google.calendar({ version: 'v3', auth });
            this.logger.log(`Google Calendar ready (target: ${this.calendarId})`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Google Calendar disabled: ${message}`);
        }
    }
    async createEvent(payload) {
        const { calendar, calendarId } = this.requireCalendar();
        const requestBody = {
            summary: payload.summary,
            description: payload.description ?? undefined,
            location: payload.location,
            start: {
                dateTime: payload.start,
                timeZone: payload.timeZone ?? 'America/Toronto',
            },
            end: {
                dateTime: payload.end,
                timeZone: payload.timeZone ?? 'America/Toronto',
            },
            attendees: payload.attendees?.map((email) => ({ email })),
        };
        this.logger.log(`Creating calendar event for "${payload.summary}"`);
        const { data } = await calendar.events.insert({
            calendarId,
            requestBody,
        });
        return data;
    }
    async deleteEvent(eventId) {
        const { calendar, calendarId } = this.requireCalendar();
        await calendar.events.delete({
            calendarId,
            eventId,
        });
        this.logger.log(`Deleted calendar event ${eventId}`);
        return { eventId, deleted: true };
    }
    async listEvents(params) {
        const { calendar, calendarId } = this.requireCalendar();
        const { data } = await calendar.events.list({
            calendarId,
            timeMin: params.timeMin,
            timeMax: params.timeMax,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return (data.items ?? [])
            .filter((event) => !!event.start?.dateTime || !!event.start?.date)
            .map((event) => ({
            id: event.id ??
                `${event.start?.dateTime ?? event.start?.date ?? Date.now()}`,
            summary: event.summary ?? 'Scheduled job',
            start: event.start?.dateTime ?? event.start?.date ?? '',
            end: event.end?.dateTime ?? event.end?.date ?? '',
            location: event.location ?? undefined,
            description: event.description ?? undefined,
        }));
    }
    requireCalendar() {
        const calendar = this.calendar;
        const calendarId = this.calendarId;
        if (!calendar || !calendarId) {
            throw new Error('Google Calendar is not configured. Set GOOGLE_CALENDAR_CREDENTIALS or GOOGLE_CALENDAR_CREDENTIALS_PATH before calling this endpoint.');
        }
        return { calendar, calendarId };
    }
};
exports.CalendarService = CalendarService;
exports.CalendarService = CalendarService = CalendarService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], CalendarService);
//# sourceMappingURL=calendar.service.js.map
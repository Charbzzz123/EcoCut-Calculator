export interface ServiceAccountCredentials {
    client_email: string;
    private_key: string;
}
export interface CalendarConfig {
    credentials: ServiceAccountCredentials;
    calendarId: string;
}
export declare function loadCalendarConfig(): CalendarConfig;

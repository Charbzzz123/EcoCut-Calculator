export type BroadcastLoadState = 'loading' | 'ready' | 'error';

export type BroadcastChannel = 'email' | 'sms' | 'both';

export type ServiceWindow = 'any' | 'last-90' | 'last-365' | 'no-history';

export type UpcomingWindow = 'any' | 'next-30' | 'next-90' | 'no-upcoming';

export interface BroadcastFilters {
  query: string;
  requireEmail: boolean;
  requirePhone: boolean;
  serviceWindow: ServiceWindow;
  upcomingWindow: UpcomingWindow;
}

export interface BroadcastRecipientCounts {
  total: number;
  emailEligible: number;
  smsEligible: number;
  bothEligible: number;
}

export interface BroadcastExclusionSummary {
  missingEmail: number;
  missingPhone: number;
  missingBoth: number;
  excludedForSelectedChannel: number;
}

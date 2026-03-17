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

export type BroadcastTemplateTarget = 'emailSubject' | 'emailBody' | 'smsBody';

export interface BroadcastTemplates {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
  ctaLink: string;
  internalNote: string;
}

export interface BroadcastMergeField {
  key: string;
  token: string;
  label: string;
  fallbackLabel: string;
}

export interface BroadcastPreviewPayload {
  clientId: string | null;
  clientLabel: string;
  emailSubject: string;
  emailBody: string;
  smsBody: string;
  activeLayers: string[];
}

export interface BroadcastSmsMetrics {
  characters: number;
  segments: number;
}

export interface BroadcastLayerOption {
  id: string;
  label: string;
}

export type BroadcastScheduleMode = 'now' | 'later';

export interface BroadcastConfirmationPayload {
  mode: 'test' | 'dispatch';
  channel: BroadcastChannel;
  recipients: number;
  scheduledAtLabel: string;
}

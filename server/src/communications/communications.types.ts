export type BroadcastChannel = 'email' | 'sms' | 'both';
export type SuppressionChannel = 'email' | 'sms';

export type BroadcastScheduleMode = 'now' | 'later';

export type CampaignStatus =
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed';

export interface EmailMessagePayload {
  to: string;
  subject: string;
  body: string;
}

export interface SmsMessagePayload {
  to: string;
  body: string;
}

export interface BroadcastDispatchRecipient {
  clientId: string;
  clientLabel: string;
  email?: string;
  phone?: string;
  emailSubject: string;
  emailBody: string;
  smsBody: string;
}

export interface SendBroadcastTestDto {
  channel: BroadcastChannel;
  scheduleMode: BroadcastScheduleMode;
  scheduleAt?: string;
  email?: EmailMessagePayload;
  sms?: SmsMessagePayload;
}

export interface DispatchBroadcastDto {
  channel: BroadcastChannel;
  scheduleMode: BroadcastScheduleMode;
  scheduleAt?: string;
  recipients: BroadcastDispatchRecipient[];
}

export interface CampaignDeliveryStats {
  recipients: number;
  attempted: number;
  sent: number;
  failed: number;
  suppressed: number;
}

export interface CampaignSummary {
  campaignId: string;
  type: 'test' | 'dispatch';
  channel: BroadcastChannel;
  status: CampaignStatus;
  scheduleMode: BroadcastScheduleMode;
  scheduleAt: string | null;
  stats: CampaignDeliveryStats;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface UpsertSuppressionDto {
  channel: BroadcastChannel;
  email?: string;
  phone?: string;
  reason?: string;
}

export interface SuppressionRecord {
  channel: SuppressionChannel;
  value: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

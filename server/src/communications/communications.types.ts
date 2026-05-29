export type BroadcastChannel = 'email' | 'sms' | 'both';
export type SuppressionChannel = 'email' | 'sms';
export type OperatorRole = 'owner' | 'manager';
export type DeliveryChannel = 'email' | 'sms';
export type DeliveryProvider = 'quo' | 'hostinger';

export type BroadcastScheduleMode = 'now' | 'later';

export type CampaignStatus =
  | 'pending_approval'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

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
  operatorRole?: OperatorRole;
  requiresApproval?: boolean;
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
  approval?: {
    required: boolean;
    requestedBy: OperatorRole;
    approvedBy?: OperatorRole;
    approvedAt?: string;
  };
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

export type CampaignAuditAction =
  | 'created'
  | 'queued'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'suppressed'
  | 'test_sent';

export interface CampaignAuditRecord {
  campaignId: string;
  timestamp: string;
  action: CampaignAuditAction;
  detail: string;
}

export type CampaignDeliveryEventType =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'resubscribed';

export interface DeliveryWebhookDto {
  campaignId: string;
  channel: DeliveryChannel;
  provider: string;
  eventType: CampaignDeliveryEventType;
  recipient: string;
  externalMessageId?: string;
  occurredAt?: string;
  reason?: string;
}

export interface ProviderWebhookResult {
  accepted: true;
  provider: DeliveryProvider;
  campaignId: string;
  eventType: CampaignDeliveryEventType;
}

export interface CampaignDeliveryEvent {
  campaignId: string;
  channel: DeliveryChannel;
  provider: string;
  eventType: CampaignDeliveryEventType;
  recipient: string;
  externalMessageId: string | null;
  occurredAt: string;
  reason: string | null;
}

export interface CampaignAnalyticsSummary {
  campaignId: string;
  totals: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    bounced: number;
    complained: number;
    unsubscribed: number;
    resubscribed: number;
  };
  byChannel: {
    email: number;
    sms: number;
  };
  latestEventAt: string | null;
}

export interface CommunicationsStateSnapshot {
  campaigns: CampaignSummary[];
  pendingDispatches: {
    campaignId: string;
    payload: DispatchBroadcastDto;
  }[];
  campaignAudit: CampaignAuditRecord[];
  campaignEvents: CampaignDeliveryEvent[];
  suppressions: SuppressionRecord[];
}

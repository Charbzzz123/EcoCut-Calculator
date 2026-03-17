import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CampaignAuditRecord,
  CampaignAnalyticsSummary,
  CampaignDeliveryEvent,
  CampaignSummary,
  DeliveryWebhookDto,
  DispatchBroadcastDto,
  OperatorRole,
  SendBroadcastTestDto,
  SmsMessagePayload,
  type CampaignStatus,
  type SuppressionRecord,
  type UpsertSuppressionDto,
} from './communications.types';
import { EMAIL_PROVIDER, type EmailProvider } from './providers/email-provider';
import { SMS_PROVIDER, type SmsProvider } from './providers/sms-provider';

const SMS_THROTTLE_MS = 120;
const EMAIL_THROTTLE_MS = 80;
const RETRY_ATTEMPTS = 2;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);
  private readonly campaigns = new Map<string, CampaignSummary>();
  private readonly pendingDispatches = new Map<string, DispatchBroadcastDto>();
  private readonly campaignAudit = new Map<string, CampaignAuditRecord[]>();
  private readonly campaignEvents = new Map<string, CampaignDeliveryEvent[]>();
  private readonly suppressions = {
    email: new Map<string, SuppressionRecord>(),
    sms: new Map<string, SuppressionRecord>(),
  };

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async sendTest(payload: SendBroadcastTestDto): Promise<CampaignSummary> {
    this.validateTestPayload(payload);
    const campaign = this.createCampaign(
      'test',
      payload.channel,
      payload.scheduleMode,
      payload.scheduleAt,
      'owner',
      false,
    );
    this.campaigns.set(campaign.campaignId, campaign);
    this.appendAudit(campaign.campaignId, 'created', 'Test campaign created.');

    if (payload.scheduleMode === 'later') {
      return this.completeScheduled(campaign.campaignId);
    }

    this.markStatus(campaign.campaignId, 'processing');
    this.appendAudit(
      campaign.campaignId,
      'processing',
      'Test campaign started.',
    );
    try {
      let attempted = 0;
      let sent = 0;
      let suppressed = 0;

      if (payload.channel === 'email' || payload.channel === 'both') {
        const emailPayload = payload.email;
        if (emailPayload) {
          if (this.isSuppressed('email', emailPayload.to)) {
            suppressed += 1;
            this.appendAudit(
              campaign.campaignId,
              'suppressed',
              `Email test destination suppressed: ${emailPayload.to}`,
            );
          } else {
            attempted += 1;
            await this.sendWithRetry(() =>
              this.emailProvider.send(emailPayload),
            );
            sent += 1;
            await sleep(EMAIL_THROTTLE_MS);
          }
        }
      }

      if (payload.channel === 'sms' || payload.channel === 'both') {
        const smsPayload = payload.sms;
        if (smsPayload) {
          if (this.isSuppressed('sms', smsPayload.to)) {
            suppressed += 1;
            this.appendAudit(
              campaign.campaignId,
              'suppressed',
              `SMS test destination suppressed: ${smsPayload.to}`,
            );
          } else {
            attempted += 1;
            await this.sendWithRetry(() => this.smsProvider.send(smsPayload));
            sent += 1;
            await sleep(SMS_THROTTLE_MS);
          }
        }
      }

      this.updateStats(campaign.campaignId, {
        recipients: 1,
        attempted,
        sent,
        failed: 0,
        suppressed,
      });
      this.markStatus(campaign.campaignId, 'completed');
      this.appendAudit(campaign.campaignId, 'test_sent', 'Test send finished.');
    } catch (error) {
      this.updateStats(campaign.campaignId, {
        recipients: 1,
        attempted: 1,
        sent: 0,
        failed: 1,
        suppressed: 0,
      });
      this.markFailed(campaign.campaignId, error);
    }

    return this.getCampaign(campaign.campaignId);
  }

  async dispatch(payload: DispatchBroadcastDto): Promise<CampaignSummary> {
    this.validateDispatchPayload(payload);
    const requestedBy = payload.operatorRole ?? 'owner';
    const requiresApproval = Boolean(
      payload.requiresApproval && requestedBy !== 'owner',
    );
    const campaign = this.createCampaign(
      'dispatch',
      payload.channel,
      payload.scheduleMode,
      payload.scheduleAt,
      requestedBy,
      requiresApproval,
    );
    this.campaigns.set(campaign.campaignId, campaign);
    this.appendAudit(
      campaign.campaignId,
      'created',
      `Dispatch campaign created by ${requestedBy}.`,
    );

    if (payload.scheduleMode === 'later') {
      this.updateStats(campaign.campaignId, {
        recipients: payload.recipients.length,
        attempted: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
      });
      return this.completeScheduled(
        campaign.campaignId,
        'Dispatch scheduled for later.',
      );
    }

    if (requiresApproval) {
      this.pendingDispatches.set(campaign.campaignId, payload);
      this.markStatus(campaign.campaignId, 'pending_approval');
      this.updateStats(campaign.campaignId, {
        recipients: payload.recipients.length,
        attempted: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
      });
      this.appendAudit(
        campaign.campaignId,
        'pending_approval',
        'Dispatch queued and awaiting owner approval.',
      );
      return this.getCampaign(campaign.campaignId);
    }

    await this.runDispatch(campaign.campaignId, payload);
    return this.getCampaign(campaign.campaignId);
  }

  async approveCampaign(
    campaignId: string,
    approvedBy: OperatorRole = 'owner',
  ): Promise<CampaignSummary> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new BadRequestException(`Campaign ${campaignId} does not exist.`);
    }
    if (campaign.status !== 'pending_approval') {
      throw new BadRequestException(
        `Campaign ${campaignId} is not waiting for approval.`,
      );
    }
    const pendingPayload = this.pendingDispatches.get(campaignId);
    if (!pendingPayload) {
      throw new BadRequestException(
        `Campaign ${campaignId} has no pending payload to approve.`,
      );
    }

    this.campaigns.set(campaignId, {
      ...campaign,
      approval: {
        required: true,
        requestedBy: campaign.approval?.requestedBy ?? 'manager',
        approvedBy,
        approvedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    this.appendAudit(
      campaignId,
      'approved',
      `Campaign approved by ${approvedBy}.`,
    );

    await this.runDispatch(campaignId, pendingPayload);
    this.pendingDispatches.delete(campaignId);
    return this.getCampaign(campaignId);
  }

  cancelCampaign(campaignId: string, reason?: string): CampaignSummary {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new BadRequestException(`Campaign ${campaignId} does not exist.`);
    }

    if (
      campaign.status !== 'scheduled' &&
      campaign.status !== 'pending_approval' &&
      campaign.status !== 'processing'
    ) {
      throw new BadRequestException(
        `Campaign ${campaignId} cannot be cancelled from status ${campaign.status}.`,
      );
    }

    this.pendingDispatches.delete(campaignId);
    this.markStatus(campaignId, 'cancelled');
    this.appendAudit(
      campaignId,
      'cancelled',
      reason?.trim() || 'Campaign cancelled by operator.',
    );

    return this.getCampaign(campaignId);
  }

  listCampaignAudit(campaignId: string): CampaignAuditRecord[] {
    if (!this.campaigns.has(campaignId)) {
      throw new BadRequestException(`Campaign ${campaignId} does not exist.`);
    }
    return [...(this.campaignAudit.get(campaignId) ?? [])];
  }

  ingestDeliveryWebhook(payload: DeliveryWebhookDto): {
    accepted: true;
  } {
    if (!this.campaigns.has(payload.campaignId)) {
      throw new BadRequestException(
        `Campaign ${payload.campaignId} does not exist.`,
      );
    }

    const event: CampaignDeliveryEvent = {
      campaignId: payload.campaignId,
      channel: payload.channel,
      provider: payload.provider.trim(),
      eventType: payload.eventType,
      recipient: payload.recipient.trim(),
      externalMessageId: payload.externalMessageId?.trim() || null,
      occurredAt: payload.occurredAt?.trim() || new Date().toISOString(),
      reason: payload.reason?.trim() || null,
    };

    const existing = this.campaignEvents.get(payload.campaignId) ?? [];
    this.campaignEvents.set(payload.campaignId, [...existing, event]);
    this.appendAudit(
      payload.campaignId,
      this.mapWebhookEventToAuditAction(payload.eventType),
      `${payload.channel.toUpperCase()} webhook ${payload.eventType} for ${event.recipient}`,
    );

    if (payload.eventType === 'unsubscribed') {
      this.applyWebhookUnsubscribe(payload.channel, event.recipient);
    }
    if (payload.eventType === 'resubscribed') {
      this.applyWebhookResubscribe(payload.channel, event.recipient);
    }

    return { accepted: true };
  }

  getCampaignAnalytics(campaignId: string): CampaignAnalyticsSummary {
    if (!this.campaigns.has(campaignId)) {
      throw new BadRequestException(`Campaign ${campaignId} does not exist.`);
    }

    const events = this.campaignEvents.get(campaignId) ?? [];
    const summary: CampaignAnalyticsSummary = {
      campaignId,
      totals: {
        queued: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        bounced: 0,
        complained: 0,
        unsubscribed: 0,
        resubscribed: 0,
      },
      byChannel: {
        email: 0,
        sms: 0,
      },
      latestEventAt: null,
    };

    for (const event of events) {
      summary.totals[event.eventType] += 1;
      summary.byChannel[event.channel] += 1;
      if (!summary.latestEventAt || event.occurredAt > summary.latestEventAt) {
        summary.latestEventAt = event.occurredAt;
      }
    }

    return summary;
  }

  private async runDispatch(
    campaignId: string,
    payload: DispatchBroadcastDto,
  ): Promise<void> {
    this.markStatus(campaignId, 'processing');
    this.appendAudit(campaignId, 'processing', 'Dispatch worker started.');
    let attempted = 0;
    let sent = 0;
    let failed = 0;
    let suppressed = 0;

    for (const recipient of payload.recipients) {
      if (payload.channel === 'email' || payload.channel === 'both') {
        const email = recipient.email;
        if (email) {
          if (this.isSuppressed('email', email)) {
            suppressed += 1;
            this.appendAudit(
              campaignId,
              'suppressed',
              `Email suppressed for ${recipient.clientLabel}.`,
            );
          } else {
            attempted += 1;
            try {
              await this.sendWithRetry(() =>
                this.emailProvider.send({
                  to: email,
                  subject: recipient.emailSubject,
                  body: recipient.emailBody,
                }),
              );
              sent += 1;
            } catch (error) {
              failed += 1;
              this.logger.warn(
                `Email delivery failed for ${recipient.clientLabel}: ${this.stringifyError(error)}`,
              );
              this.appendAudit(
                campaignId,
                'failed',
                `Email failed for ${recipient.clientLabel}.`,
              );
            }
            await sleep(EMAIL_THROTTLE_MS);
          }
        }
      }

      if (payload.channel === 'sms' || payload.channel === 'both') {
        if (recipient.phone) {
          if (this.isSuppressed('sms', recipient.phone)) {
            suppressed += 1;
            this.appendAudit(
              campaignId,
              'suppressed',
              `SMS suppressed for ${recipient.clientLabel}.`,
            );
          } else {
            attempted += 1;
            try {
              const smsPayload: SmsMessagePayload = {
                to: recipient.phone,
                body: recipient.smsBody,
              };
              await this.sendWithRetry(() => this.smsProvider.send(smsPayload));
              sent += 1;
            } catch (error) {
              failed += 1;
              this.logger.warn(
                `SMS delivery failed for ${recipient.clientLabel}: ${this.stringifyError(error)}`,
              );
              this.appendAudit(
                campaignId,
                'failed',
                `SMS failed for ${recipient.clientLabel}.`,
              );
            }
            await sleep(SMS_THROTTLE_MS);
          }
        }
      }
    }

    this.updateStats(campaignId, {
      recipients: payload.recipients.length,
      attempted,
      sent,
      failed,
      suppressed,
    });
    const finalStatus = failed > 0 ? 'failed' : 'completed';
    this.markStatus(campaignId, finalStatus);
    this.appendAudit(
      campaignId,
      finalStatus,
      finalStatus === 'completed'
        ? 'Dispatch finished successfully.'
        : 'Dispatch completed with delivery failures.',
    );
  }

  listSuppressions(): SuppressionRecord[] {
    const emailRecords = Array.from(this.suppressions.email.values());
    const smsRecords = Array.from(this.suppressions.sms.values());
    return [...emailRecords, ...smsRecords].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  upsertSuppressions(payload: UpsertSuppressionDto): SuppressionRecord[] {
    const timestamp = new Date().toISOString();
    const records: SuppressionRecord[] = [];
    const reason = payload.reason?.trim() || 'unsubscribe';

    if (payload.channel === 'email' || payload.channel === 'both') {
      const value = this.normalizeEmail(payload.email);
      if (!value) {
        throw new BadRequestException(
          'Email value is required for email suppression.',
        );
      }
      const existing = this.suppressions.email.get(value);
      const record: SuppressionRecord = {
        channel: 'email',
        value,
        reason,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      this.suppressions.email.set(value, record);
      records.push(record);
    }

    if (payload.channel === 'sms' || payload.channel === 'both') {
      const value = this.normalizePhone(payload.phone);
      if (!value) {
        throw new BadRequestException(
          'Phone value is required for SMS suppression.',
        );
      }
      const existing = this.suppressions.sms.get(value);
      const record: SuppressionRecord = {
        channel: 'sms',
        value,
        reason,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      this.suppressions.sms.set(value, record);
      records.push(record);
    }

    return records;
  }

  removeSuppressions(payload: UpsertSuppressionDto): {
    removed: number;
  } {
    let removed = 0;

    if (payload.channel === 'email' || payload.channel === 'both') {
      const value = this.normalizeEmail(payload.email);
      if (!value) {
        throw new BadRequestException(
          'Email value is required for email resubscribe.',
        );
      }
      if (this.suppressions.email.delete(value)) {
        removed += 1;
      }
    }

    if (payload.channel === 'sms' || payload.channel === 'both') {
      const value = this.normalizePhone(payload.phone);
      if (!value) {
        throw new BadRequestException(
          'Phone value is required for sms resubscribe.',
        );
      }
      if (this.suppressions.sms.delete(value)) {
        removed += 1;
      }
    }

    return { removed };
  }

  listCampaigns(): CampaignSummary[] {
    return Array.from(this.campaigns.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  getCampaign(campaignId: string): CampaignSummary {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new BadRequestException(`Campaign ${campaignId} does not exist.`);
    }
    return { ...campaign };
  }

  private validateTestPayload(payload: SendBroadcastTestDto): void {
    const hasEmailPayload = Boolean(
      payload.email?.to && payload.email.subject && payload.email.body,
    );
    const hasSmsPayload = Boolean(payload.sms?.to && payload.sms.body);
    if (payload.channel === 'email' && !hasEmailPayload) {
      throw new BadRequestException(
        'Email test payload is required for email channel.',
      );
    }
    if (payload.channel === 'sms' && !hasSmsPayload) {
      throw new BadRequestException(
        'SMS test payload is required for sms channel.',
      );
    }
    if (payload.channel === 'both' && (!hasEmailPayload || !hasSmsPayload)) {
      throw new BadRequestException(
        'Both email and SMS test payloads are required for combined channel.',
      );
    }
  }

  private validateDispatchPayload(payload: DispatchBroadcastDto): void {
    if (!payload.recipients.length) {
      throw new BadRequestException(
        'Dispatch recipients list cannot be empty.',
      );
    }
  }

  private createCampaign(
    type: 'test' | 'dispatch',
    channel: CampaignSummary['channel'],
    scheduleMode: CampaignSummary['scheduleMode'],
    scheduleAt?: string,
    requestedBy: OperatorRole = 'owner',
    requiresApproval = false,
  ): CampaignSummary {
    const timestamp = new Date().toISOString();
    const status: CampaignStatus =
      requiresApproval && scheduleMode === 'now'
        ? 'pending_approval'
        : scheduleMode === 'later'
          ? 'scheduled'
          : 'processing';
    return {
      campaignId: randomUUID(),
      type,
      channel,
      status,
      scheduleMode,
      scheduleAt: scheduleMode === 'later' ? (scheduleAt ?? null) : null,
      createdAt: timestamp,
      updatedAt: timestamp,
      stats: {
        recipients: 0,
        attempted: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
      },
      approval: {
        required: requiresApproval,
        requestedBy,
      },
    };
  }

  private markStatus(campaignId: string, status: CampaignStatus): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return;
    }
    this.campaigns.set(campaignId, {
      ...campaign,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  private markFailed(campaignId: string, error: unknown): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return;
    }
    const message = this.stringifyError(error);
    this.campaigns.set(campaignId, {
      ...campaign,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      lastError: message,
    });
    this.appendAudit(campaignId, 'failed', message);
  }

  private completeScheduled(
    campaignId: string,
    detail = 'Campaign scheduled.',
  ): CampaignSummary {
    this.markStatus(campaignId, 'scheduled');
    this.appendAudit(campaignId, 'scheduled', detail);
    return this.getCampaign(campaignId);
  }

  private updateStats(
    campaignId: string,
    stats: CampaignSummary['stats'],
  ): void {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return;
    }
    this.campaigns.set(campaignId, {
      ...campaign,
      stats,
      updatedAt: new Date().toISOString(),
    });
  }

  private async sendWithRetry(send: () => Promise<string>): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        await send();
        return;
      } catch (error) {
        lastError = error;
        if (attempt < RETRY_ATTEMPTS) {
          await sleep(200);
        }
      }
    }
    throw lastError;
  }

  private mapWebhookEventToAuditAction(
    eventType: DeliveryWebhookDto['eventType'],
  ): CampaignAuditRecord['action'] {
    if (eventType === 'unsubscribed' || eventType === 'bounced') {
      return 'suppressed';
    }
    if (eventType === 'failed') {
      return 'failed';
    }
    if (eventType === 'queued') {
      return 'queued';
    }
    if (eventType === 'sent') {
      return 'processing';
    }
    return 'completed';
  }

  private applyWebhookUnsubscribe(
    channel: DeliveryWebhookDto['channel'],
    recipient: string,
  ): void {
    if (channel === 'email') {
      this.upsertSuppressions({
        channel: 'email',
        email: recipient,
        reason: 'webhook-unsubscribe',
      });
      return;
    }
    this.upsertSuppressions({
      channel: 'sms',
      phone: recipient,
      reason: 'webhook-unsubscribe',
    });
  }

  private applyWebhookResubscribe(
    channel: DeliveryWebhookDto['channel'],
    recipient: string,
  ): void {
    if (channel === 'email') {
      this.removeSuppressions({
        channel: 'email',
        email: recipient,
      });
      return;
    }
    this.removeSuppressions({
      channel: 'sms',
      phone: recipient,
    });
  }

  private appendAudit(
    campaignId: string,
    action: CampaignAuditRecord['action'],
    detail: string,
  ): void {
    const existing = this.campaignAudit.get(campaignId) ?? [];
    this.campaignAudit.set(campaignId, [
      ...existing,
      {
        campaignId,
        timestamp: new Date().toISOString(),
        action,
        detail,
      },
    ]);
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }

  private isSuppressed(channel: 'email' | 'sms', value: string): boolean {
    if (channel === 'email') {
      const email = this.normalizeEmail(value);
      return email ? this.suppressions.email.has(email) : false;
    }
    const phone = this.normalizePhone(value);
    return phone ? this.suppressions.sms.has(phone) : false;
  }

  private normalizeEmail(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const email = value.trim().toLowerCase();
    return email.length > 0 ? email : null;
  }

  private normalizePhone(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const digits = value.replace(/\D+/gu, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    return digits.length > 0 ? digits : null;
  }
}

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CampaignSummary,
  DispatchBroadcastDto,
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
    );
    this.campaigns.set(campaign.campaignId, campaign);

    if (payload.scheduleMode === 'later') {
      return this.completeScheduled(campaign.campaignId);
    }

    this.markStatus(campaign.campaignId, 'processing');
    try {
      let attempted = 0;
      let sent = 0;
      let suppressed = 0;

      if (payload.channel === 'email' || payload.channel === 'both') {
        const emailPayload = payload.email;
        if (emailPayload) {
          if (this.isSuppressed('email', emailPayload.to)) {
            suppressed += 1;
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
    const campaign = this.createCampaign(
      'dispatch',
      payload.channel,
      payload.scheduleMode,
      payload.scheduleAt,
    );
    this.campaigns.set(campaign.campaignId, campaign);

    if (payload.scheduleMode === 'later') {
      this.updateStats(campaign.campaignId, {
        recipients: payload.recipients.length,
        attempted: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
      });
      return this.completeScheduled(campaign.campaignId);
    }

    this.markStatus(campaign.campaignId, 'processing');
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
            }
            await sleep(EMAIL_THROTTLE_MS);
          }
        }
      }

      if (payload.channel === 'sms' || payload.channel === 'both') {
        if (recipient.phone) {
          if (this.isSuppressed('sms', recipient.phone)) {
            suppressed += 1;
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
            }
            await sleep(SMS_THROTTLE_MS);
          }
        }
      }
    }

    this.updateStats(campaign.campaignId, {
      recipients: payload.recipients.length,
      attempted,
      sent,
      failed,
      suppressed,
    });
    this.markStatus(campaign.campaignId, failed > 0 ? 'failed' : 'completed');
    return this.getCampaign(campaign.campaignId);
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
  ): CampaignSummary {
    const timestamp = new Date().toISOString();
    return {
      campaignId: randomUUID(),
      type,
      channel,
      status: scheduleMode === 'later' ? 'scheduled' : 'processing',
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
  }

  private completeScheduled(campaignId: string): CampaignSummary {
    this.markStatus(campaignId, 'scheduled');
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

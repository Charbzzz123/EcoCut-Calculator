import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type DeliveryChannel = 'email' | 'sms' | 'both';
export type DeliveryScheduleMode = 'now' | 'later';

export interface BroadcastTestRequest {
  channel: DeliveryChannel;
  scheduleMode: DeliveryScheduleMode;
  scheduleAt?: string;
  email?: {
    to: string;
    subject: string;
    body: string;
  };
  sms?: {
    to: string;
    body: string;
  };
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

export interface BroadcastDispatchRequest {
  channel: DeliveryChannel;
  scheduleMode: DeliveryScheduleMode;
  scheduleAt?: string;
  recipients: BroadcastDispatchRecipient[];
}

export interface BroadcastDeliveryResult {
  campaignId: string;
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  stats: {
    recipients: number;
    attempted: number;
    sent: number;
    failed: number;
  };
  lastError?: string;
}

@Injectable({ providedIn: 'root' })
export class BroadcastDeliveryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/communications`;

  async sendTest(payload: BroadcastTestRequest): Promise<BroadcastDeliveryResult> {
    return firstValueFrom(
      this.http.post<BroadcastDeliveryResult>(`${this.baseUrl}/test`, payload),
    );
  }

  async dispatch(payload: BroadcastDispatchRequest): Promise<BroadcastDeliveryResult> {
    return firstValueFrom(
      this.http.post<BroadcastDeliveryResult>(`${this.baseUrl}/dispatch`, payload),
    );
  }
}

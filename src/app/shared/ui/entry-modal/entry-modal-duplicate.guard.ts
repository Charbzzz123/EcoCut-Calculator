import { signal } from '@angular/core';
import type {
  EntryModalPayload,
  EntryVariant,
} from '@shared/domain/entry/entry-modal.models.js';
import {
  EntryRepositoryService,
  type ClientMatchResult,
} from '@shared/domain/entry/entry-repository.service.js';

export class EntryModalDuplicateGuard {
  readonly match = signal<ClientMatchResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  private pendingPayload: EntryModalPayload | null = null;
  private pendingSignature: string | null = null;
  private confirmedSignature: string | null = null;

  constructor(private readonly entryRepository: EntryRepositoryService) {}

  reset(): void {
    this.match.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.pendingPayload = null;
    this.pendingSignature = null;
    this.confirmedSignature = null;
  }

  dismiss(): void {
    this.match.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.pendingPayload = null;
    this.pendingSignature = null;
  }

  getReason(match: ClientMatchResult | null = null): string | null {
    const candidate = match ?? this.match();
    if (!candidate) {
      return null;
    }
    switch (candidate.matchedBy) {
      case 'email':
        return 'email address';
      case 'phone-address':
        return 'phone number + address';
      case 'phone-name':
        return 'phone number + name';
      default:
        return 'name + address';
    }
  }

  confirmPending(): EntryModalPayload | null {
    if (!this.pendingPayload || !this.pendingSignature) {
      return null;
    }
    const payload = this.pendingPayload;
    this.confirmedSignature = this.pendingSignature;
    this.pendingPayload = null;
    this.pendingSignature = null;
    this.match.set(null);
    this.error.set(null);
    return payload;
  }

  async ensureClearance(
    payload: EntryModalPayload,
    signature: string,
    variant: EntryVariant,
  ): Promise<boolean> {
    if (variant !== 'customer') {
      return true;
    }
    if (this.confirmedSignature && this.confirmedSignature === signature) {
      return true;
    }

    this.error.set(null);
    this.match.set(null);
    this.loading.set(true);

    try {
      const match = await this.entryRepository.findClientMatch(payload.form);
      if (!match) {
        this.pendingPayload = null;
        this.pendingSignature = null;
        return true;
      }
      this.pendingPayload = payload;
      this.pendingSignature = signature;
      this.match.set(match);
      return false;
    } catch (error) {
      console.error('Failed to check client match', error);
      this.pendingPayload = payload;
      this.pendingSignature = signature;
      this.error.set('Unable to check for existing clients. Please retry.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async retry(variant: EntryVariant): Promise<EntryModalPayload | null> {
    if (!this.pendingPayload || !this.pendingSignature) {
      return null;
    }
    const payload = this.pendingPayload;
    const signature = this.pendingSignature;
    const allowed = await this.ensureClearance(payload, signature, variant);
    return allowed ? payload : null;
  }
}

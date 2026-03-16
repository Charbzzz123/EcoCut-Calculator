import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientMatchResult,
  EntryRepositoryService,
} from '@shared/domain/entry/entry-repository.service.js';
import type { EntryModalPayload } from '@shared/domain/entry/entry-modal.models.js';
import { EntryModalDuplicateGuard } from './entry-modal-duplicate.guard.js';

const buildPayload = (): EntryModalPayload => ({
  variant: 'customer',
  form: {
    firstName: 'Sam',
    lastName: 'Trim',
    address: '123 Main',
    phone: '(555) 111-2222',
    email: 'sam@example.com',
    jobType: 'Hedge Trim',
    jobValue: '500',
  },
  hedges: {} as EntryModalPayload['hedges'],
});

describe('EntryModalDuplicateGuard', () => {
  let entryRepository: EntryRepositoryService;
  let guard: EntryModalDuplicateGuard;
  const buildMatch = (matchedBy: ClientMatchResult['matchedBy']): ClientMatchResult => ({
    matchedBy,
    descriptor: 'match',
    client: {
      clientId: 'client-1',
      firstName: 'Sam',
      lastName: 'Trim',
      fullName: 'Sam Trim',
      address: '123 Main',
      phone: '(555) 111-2222',
      jobsCount: 1,
      lastJobDate: '2026-03-01',
    },
  });

  beforeEach(() => {
    entryRepository = {
      findClientMatch: vi.fn(),
    } as unknown as EntryRepositoryService;
    guard = new EntryModalDuplicateGuard(entryRepository);
  });

  it('skips duplicate checks for warm leads', async () => {
    const payload = buildPayload();
    const allowed = await guard.ensureClearance(payload, 'sig', 'warm-lead');

    expect(allowed).toBe(true);
    expect(entryRepository.findClientMatch).not.toHaveBeenCalled();
  });

  it('records matches and blocks submission until confirmed', async () => {
    const payload = buildPayload();
    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildMatch('phone-name'),
    );

    const allowed = await guard.ensureClearance(payload, 'sig-1', 'customer');
    expect(allowed).toBe(false);
    expect(guard.match()).not.toBeNull();

    const confirmedPayload = guard.confirmPending();
    expect(confirmedPayload).toEqual(payload);
    expect(guard.match()).toBeNull();

    // Same signature should now be auto-allowed.
    const allowedAfterConfirm = await guard.ensureClearance(payload, 'sig-1', 'customer');
    expect(allowedAfterConfirm).toBe(true);
  });

  it('retries lookup when previously blocked', async () => {
    const payload = buildPayload();
    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(buildMatch('email'))
      .mockResolvedValueOnce(null);

    await guard.ensureClearance(payload, 'sig-2', 'customer');
    expect(guard.match()).not.toBeNull();

    const retried = await guard.retry('customer');
    expect(retried).toEqual(payload);
    expect(guard.match()).toBeNull();
  });

  it('captures repository errors and leaves pending payload for retry', async () => {
    const payload = buildPayload();
    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const allowed = await guard.ensureClearance(payload, 'sig-error', 'customer');
    expect(allowed).toBe(false);
    expect(guard.match()).toBeNull();
    expect(guard.error()).toContain('Unable to check');

    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const retried = await guard.retry('customer');
    expect(retried).toEqual(payload);
  });

  it('maps match reasons for display', () => {
    expect(guard.getReason(buildMatch('email'))).toBe('email address');
    expect(guard.getReason(buildMatch('phone-address'))).toBe('phone number + address');
    expect(guard.getReason(buildMatch('phone-name'))).toBe('phone number + name');
    expect(guard.getReason(buildMatch('name-address'))).toBe('name + address');
    expect(guard.getReason()).toBeNull();
  });

  it('dismisses and resets state', async () => {
    const payload = buildPayload();
    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildMatch('email'),
    );

    await guard.ensureClearance(payload, 'sig-reset', 'customer');
    guard.dismiss();
    expect(guard.match()).toBeNull();
    expect(guard.error()).toBeNull();

    guard.reset();
    expect(guard.loading()).toBe(false);
    expect(guard.confirmPending()).toBeNull();
  });

  it('returns null when retry is invoked without pending payload', async () => {
    const retried = await guard.retry('customer');
    expect(retried).toBeNull();
  });

  it('keeps blocking retry when duplicate match still exists', async () => {
    const payload = buildPayload();
    (entryRepository.findClientMatch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(buildMatch('email'))
      .mockResolvedValueOnce(buildMatch('email'));
    await guard.ensureClearance(payload, 'sig-still-blocked', 'customer');
    const retried = await guard.retry('customer');
    expect(retried).toBeNull();
  });
});

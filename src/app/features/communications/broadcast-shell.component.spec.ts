import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import type { ClientSummary } from '@shared/domain/entry/entry-repository.service.js';
import { BroadcastFacade } from './broadcast.facade.js';
import { BroadcastShellComponent } from './broadcast-shell.component.js';
import type {
  BroadcastChannel,
  BroadcastExclusionSummary,
  BroadcastLayerOption,
  BroadcastLoadState,
  BroadcastConfirmationPayload,
  BroadcastMergeField,
  BroadcastPreviewPayload,
  BroadcastRecipientCounts,
  BroadcastSmsMetrics,
  ServiceWindow,
  BroadcastTemplates,
  UpcomingWindow,
} from './broadcast.types.js';

const createFacadeMock = () => {
  const recipients: ClientSummary[] = [
    {
      clientId: 'alex',
      firstName: 'Alex',
      lastName: 'North',
      fullName: 'Alex North',
      address: '1 Maple Street',
      phone: '(514) 555-1111',
      email: 'alex@ecocutqc.com',
      jobsCount: 3,
      lastJobDate: null,
    },
    {
      clientId: 'bella',
      firstName: 'Bella',
      lastName: 'Stone',
      fullName: 'Bella Stone',
      address: '2 Pine Avenue',
      phone: '(438) 555-2222',
      jobsCount: 2,
      lastJobDate: null,
    },
    {
      clientId: 'carter',
      firstName: 'Carter',
      lastName: 'West',
      fullName: 'Carter West',
      address: '3 Elm Road',
      phone: '555',
      email: 'carter@ecocutqc.com',
      jobsCount: 1,
      lastJobDate: null,
    },
  ];
  const loadState = signal<BroadcastLoadState>('ready');
  const counts = signal<BroadcastRecipientCounts>({
    total: 3,
    emailEligible: 2,
    smsEligible: 2,
    bothEligible: 1,
  });
  const exclusions = signal<BroadcastExclusionSummary>({
    missingEmail: 1,
    missingPhone: 1,
    missingBoth: 0,
    excludedForSelectedChannel: 2,
  });
  const channelValidationMessage = signal<string | null>(null);
  const canDispatch = signal(true);
  const filteredRecipients = signal<ClientSummary[]>(recipients);
  const channelControl = new FormControl<BroadcastChannel>('both', {
    nonNullable: true,
  });
  const serviceWindowControl = new FormControl<ServiceWindow>('any', {
    nonNullable: true,
  });
  const upcomingWindowControl = new FormControl<UpcomingWindow>('any', {
    nonNullable: true,
  });
  const queryControl = new FormControl('', { nonNullable: true });
  const requireEmailControl = new FormControl(false, { nonNullable: true });
  const requirePhoneControl = new FormControl(false, { nonNullable: true });
  const emailSubjectControl = new FormControl('EcoCut update for {{firstName}}', {
    nonNullable: true,
  });
  const emailBodyControl = new FormControl('Hi {{firstName}}', { nonNullable: true });
  const smsBodyControl = new FormControl('Hello {{firstName}}', { nonNullable: true });
  const ctaLinkControl = new FormControl('', { nonNullable: true });
  const internalNoteControl = new FormControl('', { nonNullable: true });
  const previewClientIdControl = new FormControl('alex', { nonNullable: true });
  const emailVariantControl = new FormControl('default', { nonNullable: true });
  const smsVariantControl = new FormControl('default', { nonNullable: true });
  const segmentRuleControl = new FormControl('none', { nonNullable: true });
  const overrideSubjectControl = new FormControl('', { nonNullable: true });
  const overrideEmailBodyControl = new FormControl('', { nonNullable: true });
  const overrideSmsBodyControl = new FormControl('', { nonNullable: true });
  const scheduleModeControl = new FormControl<'now' | 'later'>('now', { nonNullable: true });
  const scheduleAtControl = new FormControl('', { nonNullable: true });
  const testEmailControl = new FormControl('', { nonNullable: true });
  const testPhoneControl = new FormControl('', { nonNullable: true });
  const loadRecipients = vi.fn<() => Promise<void>>().mockResolvedValue();
  const mergeFields = signal<BroadcastMergeField[]>([
    {
      key: 'firstName',
      token: '{{firstName}}',
      label: 'First name',
      fallbackLabel: 'there',
    },
  ]);
  const templates = signal<BroadcastTemplates>({
    emailSubject: 'EcoCut update for {{firstName}}',
    emailBody: 'Hi {{firstName}}',
    smsBody: 'Hello {{firstName}}',
    ctaLink: '',
    internalNote: '',
  });
  const previewPayload = signal<BroadcastPreviewPayload>({
    clientId: 'alex',
    clientLabel: 'Alex North',
    emailSubject: 'EcoCut update for Alex',
    emailBody: 'Hi Alex',
    smsBody: 'Hello Alex',
    activeLayers: ['Base template'],
  });
  const smsMetrics = signal<BroadcastSmsMetrics>({
    characters: 11,
    segments: 1,
  });
  const emailVariants = signal<BroadcastLayerOption[]>([
    { id: 'default', label: 'Default email copy' },
    { id: 'promo', label: 'Seasonal promo emphasis' },
  ]);
  const smsVariants = signal<BroadcastLayerOption[]>([
    { id: 'default', label: 'Default SMS copy' },
    { id: 'promo', label: 'Promo SMS' },
  ]);
  const segmentRules = signal<BroadcastLayerOption[]>([
    { id: 'none', label: 'No segment rule' },
    { id: 'high-frequency', label: 'High-frequency clients (3+ jobs)' },
  ]);
  const insertMergeField = vi.fn<(target: 'emailSubject' | 'emailBody' | 'smsBody', token: string) => void>();
  const saveOverrideForPreviewClient = vi.fn<() => void>();
  const clearOverrideForPreviewClient = vi.fn<() => void>();
  const confirmationOpen = signal(false);
  const confirmationPayload = signal<BroadcastConfirmationPayload | null>(null);
  const statusBanner = signal<string | null>(null);
  const openTestConfirmation = vi.fn<() => void>();
  const openDispatchConfirmation = vi.fn<() => void>();
  const closeConfirmation = vi.fn<() => void>();
  const confirmCurrentAction = vi.fn<() => Promise<void>>().mockResolvedValue();

  return {
    queryControl,
    requireEmailControl,
    requirePhoneControl,
    emailSubjectControl,
    emailBodyControl,
    smsBodyControl,
    ctaLinkControl,
    internalNoteControl,
    previewClientIdControl,
    emailVariantControl,
    smsVariantControl,
    segmentRuleControl,
    overrideSubjectControl,
    overrideEmailBodyControl,
    overrideSmsBodyControl,
    scheduleModeControl,
    scheduleAtControl,
    testEmailControl,
    testPhoneControl,
    serviceWindowControl,
    upcomingWindowControl,
    channelControl,
    loadState,
    counts,
    exclusionSummary: exclusions,
    channelValidationMessage,
    canDispatch,
    filteredRecipients,
    mergeFields,
    templates,
    previewPayload,
    smsMetrics,
    emailVariants,
    smsVariants,
    segmentRules,
    confirmationOpen,
    confirmationPayload,
    statusBanner,
    loadRecipients,
    insertMergeField,
    saveOverrideForPreviewClient,
    clearOverrideForPreviewClient,
    openTestConfirmation,
    openDispatchConfirmation,
    closeConfirmation,
    confirmCurrentAction,
    filteredRecipientsSnapshot: vi.fn(() => filteredRecipients()),
    countsSnapshot: vi.fn(() => counts()),
    exclusionSummarySnapshot: vi.fn(() => exclusions()),
  } satisfies Partial<BroadcastFacade> & {
    queryControl: FormControl<string>;
    requireEmailControl: FormControl<boolean>;
    requirePhoneControl: FormControl<boolean>;
    emailSubjectControl: FormControl<string>;
    emailBodyControl: FormControl<string>;
    smsBodyControl: FormControl<string>;
    ctaLinkControl: FormControl<string>;
    internalNoteControl: FormControl<string>;
    previewClientIdControl: FormControl<string>;
    emailVariantControl: FormControl<string>;
    smsVariantControl: FormControl<string>;
    segmentRuleControl: FormControl<string>;
    overrideSubjectControl: FormControl<string>;
    overrideEmailBodyControl: FormControl<string>;
    overrideSmsBodyControl: FormControl<string>;
    scheduleModeControl: FormControl<'now' | 'later'>;
    scheduleAtControl: FormControl<string>;
    testEmailControl: FormControl<string>;
    testPhoneControl: FormControl<string>;
    serviceWindowControl: FormControl<ServiceWindow>;
    upcomingWindowControl: FormControl<UpcomingWindow>;
    channelControl: FormControl<BroadcastChannel>;
    loadState: ReturnType<typeof signal<BroadcastLoadState>>;
    counts: ReturnType<typeof signal<BroadcastRecipientCounts>>;
    exclusionSummary: ReturnType<typeof signal<BroadcastExclusionSummary>>;
    channelValidationMessage: ReturnType<typeof signal<string | null>>;
    canDispatch: ReturnType<typeof signal<boolean>>;
    filteredRecipients: ReturnType<typeof signal<ClientSummary[]>>;
    mergeFields: ReturnType<typeof signal<BroadcastMergeField[]>>;
    templates: ReturnType<typeof signal<BroadcastTemplates>>;
    previewPayload: ReturnType<typeof signal<BroadcastPreviewPayload>>;
    smsMetrics: ReturnType<typeof signal<BroadcastSmsMetrics>>;
    emailVariants: ReturnType<typeof signal<BroadcastLayerOption[]>>;
    smsVariants: ReturnType<typeof signal<BroadcastLayerOption[]>>;
    segmentRules: ReturnType<typeof signal<BroadcastLayerOption[]>>;
    confirmationOpen: ReturnType<typeof signal<boolean>>;
    confirmationPayload: ReturnType<typeof signal<BroadcastConfirmationPayload | null>>;
    statusBanner: ReturnType<typeof signal<string | null>>;
    loadRecipients: ReturnType<typeof vi.fn<() => Promise<void>>>;
    insertMergeField: ReturnType<typeof vi.fn<(target: 'emailSubject' | 'emailBody' | 'smsBody', token: string) => void>>;
    saveOverrideForPreviewClient: ReturnType<typeof vi.fn<() => void>>;
    clearOverrideForPreviewClient: ReturnType<typeof vi.fn<() => void>>;
    openTestConfirmation: ReturnType<typeof vi.fn<() => void>>;
    openDispatchConfirmation: ReturnType<typeof vi.fn<() => void>>;
    closeConfirmation: ReturnType<typeof vi.fn<() => void>>;
    confirmCurrentAction: ReturnType<typeof vi.fn<() => Promise<void>>>;
  };
};

describe('BroadcastShellComponent', () => {
  let fixture: ComponentFixture<BroadcastShellComponent>;
  let facadeMock: ReturnType<typeof createFacadeMock>;

  beforeEach(async () => {
    facadeMock = createFacadeMock();

    await TestBed.configureTestingModule({
      imports: [BroadcastShellComponent, RouterTestingModule],
      providers: [{ provide: BroadcastFacade, useValue: facadeMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(BroadcastShellComponent);
    fixture.detectChanges();
  });

  it('loads recipients on init and renders key summary cards', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    const cards = fixture.nativeElement.querySelectorAll('.summary-card');

    expect(facadeMock.loadRecipients).toHaveBeenCalledTimes(1);
    expect(heading?.textContent).toContain('Client broadcast');
    expect(cards.length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Email-eligible');
  });

  it('shows validation success and allows manual refresh', () => {
    const button = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    button.click();

    expect(facadeMock.loadRecipients).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Dispatch readiness: Ready');
  });

  it('shows blocked status and loading/error banners when signals change', () => {
    facadeMock.channelValidationMessage.set(
      'No recipients have an email address for the selected filters.',
    );
    facadeMock.canDispatch.set(false);
    facadeMock.loadState.set('loading');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dispatch readiness: Blocked');
    expect(fixture.nativeElement.textContent).toContain('Loading recipient roster');

    facadeMock.loadState.set('error');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load recipients right now');
  });

  it('renders composer controls, preview, and merge chip actions', () => {
    const mergeChip = fixture.nativeElement.querySelector('.merge-chip') as HTMLButtonElement;
    const smsCounter = fixture.nativeElement.querySelector('.sms-counter') as HTMLElement;
    const preview = fixture.nativeElement.querySelector('.preview-card') as HTMLElement;

    mergeChip.click();
    fixture.detectChanges();

    expect(facadeMock.insertMergeField).toHaveBeenCalledWith('emailBody', '{{firstName}}');
    expect(smsCounter.textContent).toContain('11 chars / 1 segment');
    expect(preview.textContent).toContain('Alex North');
    expect(preview.textContent).toContain('Base template');
    expect(preview.textContent).toContain('EcoCut update for Alex');
  });

  it('calls override actions from the composer', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.override-actions .refresh-btn');
    const saveButton = buttons[0] as HTMLButtonElement;
    const clearButton = buttons[1] as HTMLButtonElement;

    saveButton.click();
    clearButton.click();

    expect(facadeMock.saveOverrideForPreviewClient).toHaveBeenCalledTimes(1);
    expect(facadeMock.clearOverrideForPreviewClient).toHaveBeenCalledTimes(1);
  });

  it('renders test/dispatch controls and forwards confirmation actions', () => {
    const actions = fixture.nativeElement.querySelectorAll('.send-controls .refresh-btn');
    const sendTestButton = actions[0] as HTMLButtonElement;
    const dispatchButton = actions[1] as HTMLButtonElement;
    sendTestButton.click();
    dispatchButton.click();
    expect(facadeMock.openTestConfirmation).toHaveBeenCalledTimes(1);
    expect(facadeMock.openDispatchConfirmation).toHaveBeenCalledTimes(1);

    facadeMock.confirmationOpen.set(true);
    facadeMock.confirmationPayload.set({
      mode: 'dispatch',
      channel: 'both',
      recipients: 3,
      scheduledAtLabel: 'Send now',
    });
    facadeMock.statusBanner.set('Broadcast queued for 3 recipients.');
    fixture.detectChanges();

    const modalButtons = fixture.nativeElement.querySelectorAll('.confirmation-modal .refresh-btn');
    (modalButtons[0] as HTMLButtonElement).click();
    (modalButtons[1] as HTMLButtonElement).click();
    expect(facadeMock.confirmCurrentAction).toHaveBeenCalledTimes(1);
    expect(facadeMock.closeConfirmation).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Broadcast queued for 3 recipients');
  });

  it('renders later schedule input when mode is later', () => {
    facadeMock.scheduleModeControl.setValue('later');
    fixture.detectChanges();

    const dateTimeInput = fixture.nativeElement.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement | null;
    expect(dateTimeInput).not.toBeNull();
  });

  it('handles confirmation backdrop interactions for click and keyboard', () => {
    facadeMock.confirmationOpen.set(true);
    facadeMock.confirmationPayload.set({
      mode: 'dispatch',
      channel: 'both',
      recipients: 3,
      scheduledAtLabel: 'Send now',
    });
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('.confirmation-modal') as HTMLElement;
    modal.click();
    expect(facadeMock.closeConfirmation).toHaveBeenCalledTimes(0);

    const backdrop = fixture.nativeElement.querySelector('.confirmation-backdrop') as HTMLElement;
    backdrop.click();
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    expect(facadeMock.closeConfirmation).toHaveBeenCalledTimes(3);
  });

  it('renders test confirmation title when payload mode is test', () => {
    facadeMock.confirmationOpen.set(true);
    facadeMock.confirmationPayload.set({
      mode: 'test',
      channel: 'email',
      recipients: 1,
      scheduledAtLabel: 'Send now',
    });
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.confirmation-modal h2') as HTMLElement;
    expect(heading.textContent).toContain('Confirm test send');
  });
});

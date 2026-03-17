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
  BroadcastLoadState,
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
  });
  const smsMetrics = signal<BroadcastSmsMetrics>({
    characters: 11,
    segments: 1,
  });
  const insertMergeField = vi.fn<(target: 'emailSubject' | 'emailBody' | 'smsBody', token: string) => void>();

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
    loadRecipients,
    insertMergeField,
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
    loadRecipients: ReturnType<typeof vi.fn<() => Promise<void>>>;
    insertMergeField: ReturnType<typeof vi.fn<(target: 'emailSubject' | 'emailBody' | 'smsBody', token: string) => void>>;
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
    expect(preview.textContent).toContain('EcoCut update for Alex');
  });
});

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
  BroadcastTemplateTarget,
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
  const previewRecipients = filteredRecipients;
  const allRecipients = signal<ClientSummary[]>(recipients);
  const manualRecipients = signal<ClientSummary[]>([]);
  const excludedRecipients = signal<ClientSummary[]>([]);
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
  const insertMergeField = vi.fn<(target: BroadcastTemplateTarget, token: string) => void>();
  const saveOverrideForPreviewClient = vi.fn<() => void>();
  const clearOverrideForPreviewClient = vi.fn<() => void>();
  const addManualRecipient = vi.fn<(clientId: string) => 'added' | 'already-selected' | 'not-found'>(
    (clientId) => {
      const existing = allRecipients().find((client) => client.clientId === clientId);
      if (!existing) {
        return 'not-found';
      }
      const alreadySelected =
        filteredRecipients().some((client) => client.clientId === clientId) ||
        manualRecipients().some((client) => client.clientId === clientId);
      if (alreadySelected) {
        return 'already-selected';
      }
      manualRecipients.update((current) => [...current, existing]);
      return 'added';
    },
  );
  const removeManualRecipient = vi.fn<(clientId: string) => void>((clientId) => {
    manualRecipients.update((current) => current.filter((client) => client.clientId !== clientId));
  });
  const excludeRecipient = vi.fn<(clientId: string) => void>((clientId) => {
    const selected = filteredRecipients()
      .concat(manualRecipients())
      .find((client) => client.clientId === clientId);
    if (!selected) {
      return;
    }
    filteredRecipients.update((current) => current.filter((client) => client.clientId !== clientId));
    manualRecipients.update((current) => current.filter((client) => client.clientId !== clientId));
    excludedRecipients.update((current) =>
      current.some((client) => client.clientId === clientId) ? current : [...current, selected],
    );
  });
  const restoreExcludedRecipient = vi.fn<(clientId: string) => void>((clientId) => {
    const restored = excludedRecipients().find((client) => client.clientId === clientId);
    if (!restored) {
      return;
    }
    excludedRecipients.update((current) => current.filter((client) => client.clientId !== clientId));
    filteredRecipients.update((current) =>
      current.some((client) => client.clientId === clientId) ? current : [...current, restored],
    );
  });
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
    allRecipients,
    filteredRecipients,
    manualRecipients,
    excludedRecipients,
    previewRecipients,
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
    addManualRecipient,
    removeManualRecipient,
    excludeRecipient,
    restoreExcludedRecipient,
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
    allRecipients: ReturnType<typeof signal<ClientSummary[]>>;
    filteredRecipients: ReturnType<typeof signal<ClientSummary[]>>;
    manualRecipients: ReturnType<typeof signal<ClientSummary[]>>;
    excludedRecipients: ReturnType<typeof signal<ClientSummary[]>>;
    previewRecipients: ReturnType<typeof signal<ClientSummary[]>>;
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
    insertMergeField: ReturnType<typeof vi.fn<(target: BroadcastTemplateTarget, token: string) => void>>;
    saveOverrideForPreviewClient: ReturnType<typeof vi.fn<() => void>>;
    clearOverrideForPreviewClient: ReturnType<typeof vi.fn<() => void>>;
    addManualRecipient: ReturnType<
      typeof vi.fn<(clientId: string) => 'added' | 'already-selected' | 'not-found'>
    >;
    removeManualRecipient: ReturnType<typeof vi.fn<(clientId: string) => void>>;
    excludeRecipient: ReturnType<typeof vi.fn<(clientId: string) => void>>;
    restoreExcludedRecipient: ReturnType<typeof vi.fn<(clientId: string) => void>>;
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
    const audienceRows = fixture.nativeElement.querySelectorAll('.audience-preview__item');
    const floatingSummary = fixture.nativeElement.querySelector('.floating-summary') as HTMLElement;

    expect(facadeMock.loadRecipients).toHaveBeenCalledTimes(1);
    expect(heading?.textContent).toContain('Client broadcast');
    expect(cards.length).toBe(2);
    expect(audienceRows.length).toBe(3);
    expect(floatingSummary.textContent).toContain('Live audience snapshot');
    expect(floatingSummary.textContent).toContain('Recipients selected');
    expect(fixture.nativeElement.textContent).toContain('Email cap (daily)');
    expect(fixture.nativeElement.textContent).toContain('Alex North');
  });

  it('shows validation success and allows manual refresh', () => {
    const button = fixture.nativeElement.querySelector(
      '.board-card .refresh-btn',
    ) as HTMLButtonElement;
    button.click();

    expect(facadeMock.loadRecipients).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Dispatch readiness: Blocked');

    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dispatch readiness: Ready');
  });

  it('lets the operator modify daily caps with a confirmation step', () => {
    const modifyButton = fixture.nativeElement.querySelector(
      '.cap-controls .refresh-btn',
    ) as HTMLButtonElement;
    modifyButton.click();
    fixture.detectChanges();

    const capInputs = fixture.nativeElement.querySelectorAll(
      '.cap-editor input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    capInputs[0].value = '120';
    capInputs[0].dispatchEvent(new Event('input'));
    capInputs[1].value = '340';
    capInputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const capButtons = fixture.nativeElement.querySelectorAll(
      '.cap-editor .refresh-btn',
    ) as NodeListOf<HTMLButtonElement>;
    const reviewButton = Array.from(capButtons).find(
      (button) => button.textContent?.includes('Review changes') ?? false,
    ) as HTMLButtonElement;
    reviewButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Email 80 -> 120 | SMS 200 -> 340');

    const refreshedCapButtons = fixture.nativeElement.querySelectorAll(
      '.cap-editor .refresh-btn',
    ) as NodeListOf<HTMLButtonElement>;
    const confirmButton = Array.from(refreshedCapButtons).find(
      (button) => button.textContent?.includes('Confirm apply') ?? false,
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    const cardValues = fixture.nativeElement.querySelectorAll('.summary-card__value');
    expect(cardValues[0].textContent?.trim()).toBe('120');
    expect(cardValues[1].textContent?.trim()).toBe('340');
  });

  it('confirms channel selection and asks for reconfirmation when changed', () => {
    expect(fixture.nativeElement.textContent).toContain('Current channel: Email + SMS');

    let confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Channel confirmed: Email + SMS.');
    expect(fixture.nativeElement.querySelector('.channel-confirmation .refresh-btn')).toBeNull();

    const emailChannel = fixture.nativeElement.querySelector(
      '.channel-toggle input[value="email"]',
    ) as HTMLInputElement;
    emailChannel.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Channel changed to Email. Confirm again before moving on.',
    );
    confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    expect(confirmButton).toBeTruthy();
  });

  it('updates eligible recipient totals when Step 2 channel changes', () => {
    const host = fixture.nativeElement as HTMLElement;
    const selectedCount = (): string =>
      (
        host.querySelector('.floating-summary__list li:first-child strong') as HTMLElement
      ).textContent?.trim() ?? '';

    expect(host.textContent).toContain(
      'Both channels are valid for 1 dual-eligible recipient (3 selected).',
    );
    expect(selectedCount()).toBe('1');

    const emailChannel = host.querySelector(
      '.channel-toggle input[value="email"]',
    ) as HTMLInputElement;
    emailChannel.click();
    fixture.detectChanges();
    expect(host.textContent).toContain(
      'Email is valid for 2 email-eligible recipients (3 selected).',
    );
    expect(selectedCount()).toBe('2');

    const smsChannel = host.querySelector(
      '.channel-toggle input[value="sms"]',
    ) as HTMLInputElement;
    smsChannel.click();
    fixture.detectChanges();
    expect(host.textContent).toContain(
      'SMS is valid for 2 SMS-eligible recipients (3 selected).',
    );
    expect(selectedCount()).toBe('2');
  });

  it('shows channel-specific fields in Step 3 based on selected channel', () => {
    const host = fixture.nativeElement as HTMLElement;

    const emailChannel = host.querySelector(
      '.channel-toggle input[value="email"]',
    ) as HTMLInputElement;
    emailChannel.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Email subject');
    expect(host.textContent).toContain('Email body');
    expect(host.textContent).not.toContain('SMS body');
    expect(host.textContent).not.toContain('SMS length:');

    const smsChannel = host.querySelector(
      '.channel-toggle input[value="sms"]',
    ) as HTMLInputElement;
    smsChannel.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('SMS body');
    expect(host.textContent).toContain('SMS length:');
    expect(host.textContent).not.toContain('Email subject');
    expect(host.textContent).not.toContain('Email body');
  });

  it('renders channel status guidance as info before confirmation and warning after channel changes', () => {
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector(
      '.channel-confirmation .validation-banner',
    ) as HTMLElement;
    expect(status.classList.contains('validation-banner--info')).toBe(true);
    expect(status.textContent).toContain('Current channel: Email + SMS.');

    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    const emailChannel = fixture.nativeElement.querySelector(
      '.channel-toggle input[value="email"]',
    ) as HTMLInputElement;
    emailChannel.click();
    fixture.detectChanges();

    const warningStatus = fixture.nativeElement.querySelector(
      '.channel-confirmation .validation-banner',
    ) as HTMLElement;
    expect(warningStatus.classList.contains('validation-banner--advisory')).toBe(true);
    expect(warningStatus.textContent).toContain('Channel changed to Email.');
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

  it('shows an empty audience state when filters match no recipients', () => {
    facadeMock.filteredRecipients.set([]);
    facadeMock.counts.set({ total: 0, emailEligible: 0, smsEligible: 0, bothEligible: 0 });
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.audience-preview__empty') as HTMLElement;
    expect(emptyState.textContent).toContain('No recipients match these filters yet.');
    expect(fixture.nativeElement.textContent).toContain('Showing 0 recipients');
  });

  it('adds existing roster clients manually from Step 1 and allows removing them', () => {
    facadeMock.filteredRecipients.set([facadeMock.filteredRecipients()[0]]);
    facadeMock.counts.set({ total: 1, emailEligible: 1, smsEligible: 1, bothEligible: 1 });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toggleButton = host.querySelector(
      '.manual-audience .refresh-btn--secondary',
    ) as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    const searchInput = host.querySelector(
      'input[placeholder="Search full roster by name, address, email, or phone"]',
    ) as HTMLInputElement;
    searchInput.value = 'Carter';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const candidateCheckbox = host.querySelector(
      '.manual-picker__item input[type="checkbox"]',
    ) as HTMLInputElement;
    candidateCheckbox.click();
    fixture.detectChanges();

    const addButton = Array.from(host.querySelectorAll('.manual-audience .refresh-btn')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Add selected'),
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    expect(facadeMock.addManualRecipient).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Added 1 client from your roster.');
    expect(host.textContent).toContain('Carter West');

    const removeButton = host.querySelector(
      '.manual-audience__item .refresh-btn--compact',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(facadeMock.removeManualRecipient).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Manual roster selection removed.');
  });

  it('shows validation guidance when no manual roster clients are selected', () => {
    facadeMock.filteredRecipients.set([facadeMock.filteredRecipients()[0]]);
    facadeMock.counts.set({ total: 1, emailEligible: 1, smsEligible: 1, bothEligible: 1 });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const toggleButton = host.querySelector(
      '.manual-audience .refresh-btn--secondary',
    ) as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    const addButton = Array.from(host.querySelectorAll('.manual-audience .refresh-btn')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Add selected'),
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Select at least one existing client to add manually.');

    expect(facadeMock.addManualRecipient).toHaveBeenCalledTimes(0);
  });

  it('allows removing a recipient from the audience list and restoring it', () => {
    const host = fixture.nativeElement as HTMLElement;
    const initialRows = host.querySelectorAll('.audience-preview__item').length;
    const removeButton = host.querySelector(
      '.audience-preview__item .refresh-btn--compact',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(facadeMock.excludeRecipient).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Excluded recipients:');
    expect(host.querySelectorAll('.audience-preview__item').length).toBeLessThan(initialRows);

    facadeMock.excludedRecipients.set([
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
    ]);
    fixture.detectChanges();

    const restoreButton = Array.from(host.querySelectorAll('.manual-audience .refresh-btn')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Restore'),
    ) as HTMLButtonElement;
    restoreButton.click();
    fixture.detectChanges();

    expect(facadeMock.restoreExcludedRecipient).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('.audience-preview__item').length).toBeGreaterThanOrEqual(initialRows);
  });

  it('removes manual-only recipients without sending them to excluded recipients', () => {
    const manualOnly = {
      clientId: 'manual-only',
      firstName: 'Manual',
      lastName: 'Only',
      fullName: 'Manual Only',
      address: '88 Test Street',
      phone: '(555) 111-2222',
      email: 'manual@ecocutqc.com',
      jobsCount: 0,
      lastJobDate: null,
    } as ClientSummary;

    facadeMock.filteredRecipients.set([facadeMock.filteredRecipients()[0]]);
    facadeMock.manualRecipients.set([manualOnly]);
    facadeMock.allRecipients.set([...facadeMock.allRecipients(), manualOnly]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const manualRow = Array.from(host.querySelectorAll('.audience-preview__item')).find((row) =>
      (row as HTMLElement).textContent?.includes('Manual Only'),
    ) as HTMLElement;
    const removeButton = manualRow.querySelector('.refresh-btn--compact') as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();

    expect(facadeMock.removeManualRecipient).toHaveBeenCalledWith('manual-only');
    expect(facadeMock.excludeRecipient).not.toHaveBeenCalledWith('manual-only');
    expect(host.textContent).not.toContain('Excluded recipients: 1');
  });

  it('shows singular recipient wording when exactly one recipient is visible', () => {
    facadeMock.filteredRecipients.set([facadeMock.filteredRecipients()[0]]);
    facadeMock.counts.set({ total: 1, emailEligible: 1, smsEligible: 1, bothEligible: 1 });
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector('.audience-preview__label') as HTMLElement;
    expect(label.textContent?.replace(/\s+/g, ' ').trim()).toContain('Showing 1 recipient');
  });

  it('renders missing-channel badges for recipients without email or SMS', () => {
    facadeMock.filteredRecipients.set([
      {
        clientId: 'no-channel',
        firstName: 'No',
        lastName: 'Channel',
        fullName: 'No Channel',
        address: '4 Cedar Lane',
        phone: '123',
        jobsCount: 0,
        lastJobDate: null,
      },
    ]);
    facadeMock.counts.set({ total: 1, emailEligible: 0, smsEligible: 0, bothEligible: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Missing channel');
  });

  it('renders composer controls, preview, and merge chip actions', () => {
    const mergeChip = fixture.nativeElement.querySelector('.merge-chip') as HTMLButtonElement;
    const smsCounter = fixture.nativeElement.querySelector('.sms-counter') as HTMLElement;
    const preview = fixture.nativeElement.querySelector('.preview-card') as HTMLElement;

    mergeChip.click();
    fixture.detectChanges();

    expect(facadeMock.emailBodyControl.value).toContain('Hi {{firstName}}[[First name]]');
    expect(smsCounter.textContent).toContain('11 chars / 1 segment');
    expect(preview.textContent).toContain('Alex North');
    expect(preview.textContent).toContain('EcoCut update for Alex');
  });

  it('shows active layers only when additional layers are applied', () => {
    const preview = fixture.nativeElement.querySelector('.preview-card') as HTMLElement;
    expect(preview.textContent).not.toContain('Active layers');

    facadeMock.previewPayload.set({
      ...facadeMock.previewPayload(),
      activeLayers: ['Base template', 'Email variant: Seasonal promo emphasis'],
    });
    fixture.detectChanges();

    expect(preview.textContent).toContain('Active layers');
    expect(preview.textContent).toContain('Email variant: Seasonal promo emphasis');
  });

  it('inserts merge token at the last focused cursor position', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    component['onTokenEditorFocus']('emailSubject');
    fixture.detectChanges();

    const mergeChip = fixture.nativeElement.querySelector('.merge-chip') as HTMLButtonElement;
    mergeChip.click();
    fixture.detectChanges();

    expect(facadeMock.emailSubjectControl.value).toBe('EcoCut update for {{firstName}}[[First name]]');
  });

  it('calls override actions from the composer', () => {
    const toggleButton = fixture.nativeElement.querySelector(
      '.override-toggle .refresh-btn',
    ) as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    const overrideCard = fixture.nativeElement.querySelector('.override-card') as HTMLElement;
    expect(overrideCard).toBeTruthy();
    const buttons = overrideCard.querySelectorAll('.override-actions .refresh-btn');
    const saveButton = buttons[0] as HTMLButtonElement;
    const clearButton = buttons[1] as HTMLButtonElement;

    saveButton.click();
    clearButton.click();

    expect(facadeMock.saveOverrideForPreviewClient).toHaveBeenCalledTimes(1);
    expect(facadeMock.clearOverrideForPreviewClient).toHaveBeenCalledTimes(1);
  });

  it('keeps per-client override panel collapsed by default and toggles visibility', () => {
    const host = fixture.nativeElement as HTMLElement;
    const panel = host.querySelector('.preview-shell .motion-collapse') as HTMLElement;
    expect(panel.classList.contains('motion-collapse--expanded')).toBe(false);

    const toggleButton = host.querySelector('.override-toggle .refresh-btn') as HTMLButtonElement;
    expect(toggleButton.textContent).toContain('Show per-client override');
    toggleButton.click();
    fixture.detectChanges();

    expect(panel.classList.contains('motion-collapse--expanded')).toBe(true);
    expect(host.querySelector('.override-card')).toBeTruthy();
    const updatedToggleButton = host.querySelector('.override-toggle .refresh-btn') as HTMLButtonElement;
    expect(updatedToggleButton.textContent).toContain('Hide per-client override');
  });

  it('renders test/dispatch controls and forwards confirmation actions', () => {
    vi.useFakeTimers();
    facadeMock.channelControl.setValue('email');
    facadeMock.testEmailControl.setValue('owner@ecocutqc.com');
    facadeMock.testPhoneControl.setValue('');
    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelectorAll('.send-controls .refresh-btn');
    const dispatchButton = actions[1] as HTMLButtonElement;
    expect(dispatchButton.disabled).toBe(false);
    dispatchButton.click();
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
    (modalButtons[1] as HTMLButtonElement).click();
    vi.advanceTimersByTime(220);
    fixture.detectChanges();
    const refreshedModalButtons = fixture.nativeElement.querySelectorAll(
      '.confirmation-modal .refresh-btn',
    );
    (refreshedModalButtons[0] as HTMLButtonElement).click();
    expect(facadeMock.confirmCurrentAction).toHaveBeenCalledTimes(1);
    expect(facadeMock.closeConfirmation).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Broadcast queued for 3 recipients');
    vi.useRealTimers();
  });

  it('forwards test-send action through the shell', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    component['openTestConfirmation']();
    expect(facadeMock.openTestConfirmation).toHaveBeenCalledTimes(1);
  });

  it('disables test send and shows reason when destinations are missing', () => {
    facadeMock.channelControl.setValue('both');
    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    facadeMock.testEmailControl.setValue('');
    facadeMock.testPhoneControl.setValue('');
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelectorAll('.send-controls .refresh-btn');
    const sendTestButton = actions[0] as HTMLButtonElement;
    expect(sendTestButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'If you want to send a test, enter valid test email and test SMS destinations.',
    );
  });

  it('blocks dispatch when required message fields are missing', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;

    facadeMock.channelControl.setValue('email');
    component['confirmSelectedChannel']();
    facadeMock.emailBodyControl.setValue('');
    expect(component['dispatchBlockedReason']()).toBe(
      'Add all required subject/body fields for the selected channel.',
    );
  });

  it('shows channel-specific test destination warnings', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;

    facadeMock.channelControl.setValue('email');
    component['confirmSelectedChannel']();
    facadeMock.emailBodyControl.setValue('Email body');
    facadeMock.testEmailControl.setValue('');
    expect(component['testBlockedReason']()).toBe(
      'If you want to send a test, enter a valid test email destination.',
    );

    facadeMock.channelControl.setValue('sms');
    component['confirmSelectedChannel']();
    facadeMock.smsBodyControl.setValue('SMS body');
    facadeMock.testPhoneControl.setValue('');
    expect(component['testBlockedReason']()).toBe(
      'If you want to send a test, enter a valid test SMS destination.',
    );

    facadeMock.channelControl.setValue('both');
    component['confirmSelectedChannel']();
    facadeMock.testEmailControl.setValue('owner@ecocutqc.com');
    facadeMock.testPhoneControl.setValue('');
    expect(component['testBlockedReason']()).toBe(
      'If you want to send a test, enter valid test email and test SMS destinations.',
    );
  });

  it('blocks send actions until channel selection is confirmed', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    expect(component['dispatchBlockedReason']()).toBe(
      'Confirm the channel selection in Step 2 before sending.',
    );
    expect(component['canConfirmDispatch']()).toBe(false);
    expect(component['canSendTest']()).toBe(false);
  });

  it('renders the shared channel-confirmation block reason only once', () => {
    fixture.detectChanges();
    const banners = fixture.nativeElement.querySelectorAll('.send-controls .validation-banner');
    expect(banners.length).toBe(1);
    expect((banners[0] as HTMLElement).textContent).toContain(
      'Confirm the channel selection in Step 2 before sending.',
    );
  });

  it('requires a timestamp when schedule mode is later', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    facadeMock.channelControl.setValue('email');
    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    facadeMock.scheduleModeControl.setValue('later');
    facadeMock.scheduleAtControl.setValue('');

    expect(component['dispatchBlockedReason']()).toBe(
      'Pick a scheduled timestamp before confirming broadcast.',
    );
  });

  it('renders SMS confirmation status when SMS channel is confirmed', () => {
    facadeMock.channelControl.setValue('sms');
    const confirmButton = fixture.nativeElement.querySelector(
      '.channel-confirmation .refresh-btn',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Channel confirmed: SMS.');
  });

  it('normalizes test email and phone inputs to valid format targets', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;

    facadeMock.testEmailControl.setValue('  OWNER@ecocutqc.com ');
    component['onTestEmailInput']();
    expect(facadeMock.testEmailControl.value).toBe('owner@ecocutqc.com');

    facadeMock.testPhoneControl.setValue('+1 (438) 800-7177 ext.99');
    component['onTestPhoneInput']();
    expect(facadeMock.testPhoneControl.value).toBe('(438) 800-7177');

    facadeMock.testPhoneControl.setValue('43');
    component['onTestPhoneInput']();
    expect(facadeMock.testPhoneControl.value).toBe('43');

    facadeMock.testPhoneControl.setValue('43880');
    component['onTestPhoneInput']();
    expect(facadeMock.testPhoneControl.value).toBe('(438) 80');
  });

  it('tracks drag target and carries token metadata during drag operations', async () => {
    const component = fixture.componentInstance as BroadcastShellComponent;

    const dragPayload = {
      getData: vi.fn(() => '[[Address]]'),
      setData: vi.fn(),
      effectAllowed: 'copy',
      dropEffect: 'none',
    };

    component['onMergeChipDragStart'](
      { dataTransfer: dragPayload } as unknown as DragEvent,
      '[[Address]]',
      'Address',
    );
    expect(dragPayload.setData).toHaveBeenCalledWith('text/plain', '[[Address]]');
    expect(dragPayload.setData).toHaveBeenCalledWith('application/ecocut-merge-token', '[[Address]]');
    expect(dragPayload.setData).toHaveBeenCalledWith('application/ecocut-merge-label', 'Address');
    component['onTemplateDragOver'](
      {
        dataTransfer: dragPayload,
      } as unknown as DragEvent,
      'emailBody',
    );
    expect(component['isMergeDragTarget']('emailBody')).toBe(true);

    component['onTemplateDrop'](
      {
        currentTarget: null,
        target: null,
      } as unknown as DragEvent,
      'emailBody',
    );
    await Promise.resolve();

    expect(component['isMergeDragTarget']('emailBody')).toBe(false);
    component['onTokenEditorFocus']('emailBody');
    component['insertMergeField']('[[Address]]', 'emailBody');
    expect(facadeMock.emailBodyControl.value).toContain('[[Address]]');
  });

  it('navigates preview recipients with previous/next controls', () => {
    facadeMock.previewClientIdControl.setValue('alex');
    facadeMock.testEmailControl.setValue('owner@ecocutqc.com');
    facadeMock.testPhoneControl.setValue('(514) 555-0000');
    fixture.detectChanges();

    const navButtons = fixture.nativeElement.querySelectorAll('.preview-nav .refresh-btn');
    let previousButton = navButtons[0] as HTMLButtonElement;
    const nextButton = navButtons[1] as HTMLButtonElement;

    expect(previousButton.disabled).toBe(true);
    nextButton.click();
    fixture.detectChanges();
    expect(facadeMock.previewClientIdControl.value).toBe('bella');

    previousButton = fixture.nativeElement.querySelectorAll('.preview-nav .refresh-btn')[0] as HTMLButtonElement;
    previousButton.click();
    fixture.detectChanges();
    expect(facadeMock.previewClientIdControl.value).toBe('alex');
  });

  it('opens the preview dropdown and selects a client option', () => {
    vi.useFakeTimers();
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector('.preview-shell .select-dropdown__trigger') as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();

    const options = host.querySelectorAll(
      '.preview-shell .select-dropdown__option',
    ) as NodeListOf<HTMLButtonElement>;
    const bellaOption = Array.from(options).find((option) =>
      option.textContent?.includes('Bella Stone'),
    ) as HTMLButtonElement;
    bellaOption.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(180);
    fixture.detectChanges();

    expect(facadeMock.previewClientIdControl.value).toBe('bella');
    expect(host.querySelector('.preview-shell .select-dropdown__menu')).toBeNull();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('closes preview dropdown when clicking outside the selector', () => {
    vi.useFakeTimers();
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector('.preview-shell .select-dropdown__trigger') as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    expect(host.querySelector('.preview-shell .select-dropdown__menu')).toBeTruthy();

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    vi.advanceTimersByTime(180);
    fixture.detectChanges();

    expect(host.querySelector('.preview-shell .select-dropdown__menu')).toBeNull();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('ignores preview moves when list is too short or out of bounds', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    facadeMock.filteredRecipients.set([facadeMock.filteredRecipients()[0]]);
    facadeMock.previewClientIdControl.setValue('alex');
    component['movePreview'](1);
    expect(facadeMock.previewClientIdControl.value).toBe('alex');

    facadeMock.filteredRecipients.set([
      ...facadeMock.filteredRecipients(),
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
    ]);
    facadeMock.previewClientIdControl.setValue('bella');
    component['movePreview'](1);
    expect(facadeMock.previewClientIdControl.value).toBe('bella');
  });

  it('falls back gracefully when preview id is unknown', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    facadeMock.previewClientIdControl.setValue('unknown-client');

    expect(component['canGoToNextPreview']()).toBe(true);
    component['movePreview'](1);
    expect(facadeMock.previewClientIdControl.value).toBe('bella');
  });

  it('treats nullish SMS values as not capable', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;
    expect(component['isSmsCapable'](null)).toBe(false);
  });

  it('returns fallback preview labels for empty and unknown recipients', () => {
    facadeMock.previewRecipients.set([]);
    fixture.detectChanges();
    let trigger = fixture.nativeElement.querySelector(
      '.preview-shell .select-dropdown__trigger',
    ) as HTMLButtonElement;
    expect(trigger.textContent).toContain('No eligible recipients for selected channel');
    expect(trigger.disabled).toBe(true);

    facadeMock.previewRecipients.set([
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
    ]);
    facadeMock.previewClientIdControl.setValue('missing-id');
    fixture.detectChanges();
    trigger = fixture.nativeElement.querySelector(
      '.preview-shell .select-dropdown__trigger',
    ) as HTMLButtonElement;
    expect(trigger.textContent).toContain('Alex North');
    expect(trigger.disabled).toBe(false);
  });

  it('renders later schedule input when mode is later', () => {
    const trigger = fixture.nativeElement.querySelector(
      '.send-controls button[aria-label="Schedule mode selector"]',
    ) as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll(
      '.send-controls .select-dropdown__option',
    ) as NodeListOf<HTMLButtonElement>;
    const laterOption = Array.from(options).find((option) =>
      option.textContent?.includes('Schedule for later'),
    ) as HTMLButtonElement;
    laterOption.click();
    fixture.detectChanges();

    const dateTimeInput = fixture.nativeElement.querySelector(
      'input[type="datetime-local"]',
    ) as HTMLInputElement | null;
    expect(dateTimeInput).not.toBeNull();
  });

  it('handles confirmation backdrop interactions for click and keyboard', () => {
    vi.useFakeTimers();
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
    vi.advanceTimersByTime(220);
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    vi.advanceTimersByTime(220);
    backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    vi.advanceTimersByTime(220);

    expect(facadeMock.closeConfirmation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
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

  it('computes campaign cost estimates per channel', () => {
    const component = fixture.componentInstance as BroadcastShellComponent;

    facadeMock.channelControl.setValue('email');
    fixture.detectChanges();
    expect(component['costEstimate']().emailRecipients).toBe(2);
    expect(component['costEstimate']().smsRecipients).toBe(0);

    facadeMock.smsMetrics.set({ characters: 350, segments: 3 });
    facadeMock.channelControl.setValue('sms');
    fixture.detectChanges();
    expect(component['costEstimate']().smsRecipients).toBe(2);
    expect(component['costEstimate']().smsSegmentsTotal).toBe(6);

    facadeMock.channelControl.setValue('both');
    fixture.detectChanges();
    expect(component['costEstimate']().emailRecipients).toBe(1);
    expect(component['costEstimate']().smsRecipients).toBe(1);
  });

  it('renders the estimated campaign pricing panel', () => {
    const panel = fixture.nativeElement.querySelector('.cost-estimate') as HTMLElement;
    expect(panel.textContent).toContain('Estimated cost (CAD)');
    expect(panel.textContent).toContain('Total estimate');
    expect(panel.textContent).toContain('Estimate only.');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import type { ClientDetail } from '@shared/domain/entry/entry-repository.service.js';
import { createEmptyHedgeConfigs } from '@shared/domain/entry/entry-modal.models.js';
import { ClientDetailDrawerComponent } from './client-detail-drawer.component.js';

const detail: ClientDetail = {
  clientId: 'alex@example.com',
  firstName: 'Alex',
  lastName: 'Stone',
  fullName: 'Alex Stone',
  address: '123 Pine Ave',
  phone: '(438) 555-1111',
  email: 'alex@example.com',
  jobsCount: 2,
  lastJobDate: '2026-03-04T12:00:00Z',
  nextJobDate: '2026-03-10T12:00:00Z',
  history: [
    {
      entryId: 'job-1',
      createdAt: '2026-03-04T12:00:00Z',
      variant: 'customer',
      salesStatus: 'accepted',
      jobType: 'Hedge Trimming',
      jobValue: '$920',
      location: '123 Pine Ave',
      contactPhone: '(438) 555-1111',
      contactEmail: 'alex@example.com',
      desiredBudget: '$800',
      additionalDetails: 'Leave debris curbside.',
      calendar: {
        start: '2026-03-05T10:00:00Z',
        end: '2026-03-05T11:30:00Z',
        timeZone: 'America/Toronto',
      },
      execution: {
        status: 'completed',
        startedAt: '2026-03-05T10:05:00Z',
        endedAt: '2026-03-05T11:40:00Z',
        completionNote: 'Gate cleanup done.',
        completedByRole: 'owner',
        totalHours: 1.58,
        crew: [{ employeeId: 'emp-1', fullName: 'Alex Stone', hoursWorked: 1.58 }],
        updatedAt: '2026-03-05T11:40:00Z',
      },
      hedges: createEmptyHedgeConfigs(),
      hedgePlan: ['Front Trim (i,t)'],
      form: {
        firstName: 'Alex',
        lastName: 'Stone',
        address: '123 Pine Ave',
        phone: '(438) 555-1111',
        email: 'alex@example.com',
        jobType: 'Hedge Trimming',
        jobValue: '$920',
        desiredBudget: '$800',
        additionalDetails: 'Leave debris curbside.',
      },
    },
  ],
};

describe('ClientDetailDrawerComponent', () => {
  let fixture: ComponentFixture<ClientDetailDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDetailDrawerComponent, RouterTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ClientDetailDrawerComponent);
    fixture.componentInstance.client = detail;
  });

  it('shows loading state when requested', () => {
    fixture.componentInstance.state = 'loading';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading history');
  });

  it('renders the edit form when toggled', () => {
    fixture.componentInstance['editingClient'] = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.client-form')).toBeTruthy();
  });

  it('renders history entries and identifies finished work', () => {
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = detail;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hedge Trimming');
    expect(fixture.nativeElement.textContent).toContain('(438) 555-1111');
    expect(fixture.nativeElement.textContent).toContain('Crew on job');
    expect(fixture.nativeElement.textContent).toContain('Gate cleanup done.');
    expect(fixture.nativeElement.textContent).toContain('Finished');
  });

  it('keeps the drawer heading reference valid when the client id contains spaces', () => {
    fixture.componentInstance.client = {
      ...detail,
      clientId: 'demo::lead::123 demo lane',
    };
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const heading = fixture.nativeElement.querySelector('h2') as HTMLHeadingElement;
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.id).not.toMatch(/\s/);
  });

  it('emits retry when error state button is clicked', () => {
    const retrySpy = vi.fn();
    fixture.componentInstance.state = 'error';
    fixture.componentInstance.retry.subscribe(retrySpy);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '.client-drawer__section-heading button.ghost',
    ) as HTMLButtonElement;
    button.click();
    expect(retrySpy).toHaveBeenCalled();
  });

  it('renders empty states when contact data is missing', () => {
    fixture.componentInstance.client = {
      ...detail,
      email: undefined,
      lastJobDate: '',
      nextJobDate: undefined,
    };
    const emptyDetail: ClientDetail = { ...detail, history: [] };
    fixture.componentInstance.detail = emptyDetail;
    fixture.componentInstance.state = 'ready';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No jobs recorded yet.');
    expect(fixture.nativeElement.textContent).not.toContain('Email');
  });

  it('shows hedge plan and emits job edit/delete actions', () => {
    const editSpy = vi.fn();
    const deleteSpy = vi.fn();
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = detail;
    fixture.componentInstance.editEntry.subscribe(editSpy);
    fixture.componentInstance.deleteEntry.subscribe(deleteSpy);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Front Trim');
    expect(fixture.nativeElement.textContent).toContain('Accepted');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.history__actions button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Edit job'))?.click();
    buttons.find((button) => button.textContent?.includes('Delete job'))?.click();
    expect(editSpy).toHaveBeenCalledWith(detail.history[0]);
    expect(deleteSpy).toHaveBeenCalledWith(detail.history[0]);
  });

  it('offers outcome actions for open opportunities and emits stable statuses', () => {
    const statusSpy = vi.fn();
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = {
      ...detail,
      relationshipStatus: 'lead',
      openOpportunityCount: 1,
      history: [
        { ...detail.history[0], variant: 'warm-lead', salesStatus: 'open', execution: undefined },
      ],
    };
    fixture.componentInstance.changeSalesStatus.subscribe(statusSpy);
    fixture.detectChanges();
    const acceptedButton = fixture.nativeElement.querySelector(
      '[aria-label="Mark Hedge Trimming accepted"]',
    ) as HTMLButtonElement;
    const notProceedingButton = fixture.nativeElement.querySelector(
      '[aria-label="Mark Hedge Trimming not proceeding"]',
    ) as HTMLButtonElement;
    expect(acceptedButton).toBeTruthy();
    expect(notProceedingButton).toBeTruthy();
    acceptedButton.click();
    notProceedingButton.click();
    expect(statusSpy).toHaveBeenNthCalledWith(1, {
      history: fixture.componentInstance.detail!.history[0],
      salesStatus: 'accepted',
    });
    expect(statusSpy).toHaveBeenNthCalledWith(2, {
      history: fixture.componentInstance.detail!.history[0],
      salesStatus: 'not-proceeding',
    });
  });

  it('offers reopen for closed opportunities and shows the client open count', () => {
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.client = {
      ...detail,
      relationshipStatus: 'inactive',
      openOpportunityCount: 0,
    };
    fixture.componentInstance.detail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          salesStatus: 'not-proceeding',
          execution: undefined,
          calendar: undefined,
        },
      ],
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inactive');
    expect(fixture.nativeElement.textContent).toContain('Not proceeding');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Reopen Hedge Trimming"]'),
    ).toBeTruthy();
  });

  it('shows Inactive when every opportunity was not proceeding', () => {
    fixture.componentInstance.client = { ...detail, relationshipStatus: 'inactive' };
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = {
      ...detail,
      relationshipStatus: 'inactive',
      history: [
        {
          ...detail.history[0],
          salesStatus: 'not-proceeding',
          execution: undefined,
          calendar: undefined,
        },
      ],
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inactive');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Reopen Hedge Trimming"]'),
    ).toBeTruthy();
  });

  it('marks accepted jobs without a date as To schedule', () => {
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.client = {
      ...detail,
      relationshipStatus: 'customer',
      toScheduleCount: 1,
    };
    fixture.componentInstance.detail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          salesStatus: 'accepted',
          calendar: undefined,
          execution: undefined,
          followUpNote: 'Call back next month.',
        },
      ],
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Accepted · To schedule');
    expect(fixture.nativeElement.textContent).toContain('Follow-up: Call back next month.');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Schedule Hedge Trimming"]'),
    ).toBeTruthy();
  });

  it('does not flag a finished accepted job as needing scheduling', () => {
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.client = { ...detail, relationshipStatus: 'customer' };
    fixture.componentInstance.detail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          salesStatus: 'accepted',
          calendar: undefined,
          execution: { ...detail.history[0].execution!, status: 'completed' },
        },
      ],
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Finished');
    expect(fixture.nativeElement.textContent).toContain('Completed');
    expect(fixture.nativeElement.textContent).not.toContain('To schedule');
  });

  it('emits client updates when editing form is saved', () => {
    const updateSpy = vi.fn();
    fixture.componentInstance.updateClient.subscribe(updateSpy);
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance.clientForm.controls.firstName.setValue('Alicia');
    fixture.componentInstance['submitClientEdits']();
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Alicia' }));
  });

  it('emits delete client event when requested', () => {
    const deleteSpy = vi.fn();
    fixture.componentInstance.deleteClient.subscribe(deleteSpy);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '.client-drawer__header-actions .danger',
    ) as HTMLButtonElement;
    button.click();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('marks the form invalid when required fields are empty', () => {
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance.clientForm.controls.firstName.setValue('');
    fixture.componentInstance['submitClientEdits']();
    expect(fixture.componentInstance.clientForm.invalid).toBe(true);
  });

  it('emits updates for every editable field', () => {
    const updateSpy = vi.fn();
    fixture.componentInstance.updateClient.subscribe(updateSpy);
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance.clientForm.setValue({
      firstName: 'Alex',
      lastName: 'Stone Jr',
      address: '999 Birch',
      phone: '123',
      email: 'alexjr@example.com',
    });
    fixture.componentInstance['submitClientEdits']();
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        lastName: 'Stone Jr',
        address: '999 Birch',
        phone: '123',
        email: 'alexjr@example.com',
      }),
    );
  });

  it('skips emitting when nothing changed', () => {
    const updateSpy = vi.fn();
    fixture.componentInstance.updateClient.subscribe(updateSpy);
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance['submitClientEdits']();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('toggles edit mode via header actions', () => {
    fixture.detectChanges();
    const editButton = fixture.nativeElement.querySelector(
      '.client-drawer__header-actions button.ghost',
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.client-form')).toBeTruthy();
    const cancelButton = fixture.nativeElement.querySelector(
      '.client-drawer__header-actions button.ghost',
    ) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();
    expect(fixture.componentInstance['editingClient']).toBe(false);
  });

  it('submits edits through the form binding', () => {
    const component = fixture.componentInstance as ClientDetailDrawerComponent & {
      submitClientEdits(): void;
    };
    const submitSpy = vi.spyOn(component, 'submitClientEdits');
    fixture.detectChanges();
    const editButton = fixture.nativeElement.querySelector(
      '.client-drawer__header-actions button.ghost',
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('.client-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    expect(submitSpy).toHaveBeenCalled();
  });

  it('resets the form when cancelClientEdit is invoked', () => {
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance.clientForm.controls.firstName.setValue('Reset');
    fixture.componentInstance['cancelClientEdit']();
    expect(fixture.componentInstance.clientForm.controls.firstName.value).toBe('');
  });

  it('emits closed when the close button is clicked', () => {
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.detectChanges();
    const closeButton = fixture.nativeElement.querySelector(
      '.client-drawer__close',
    ) as HTMLButtonElement;
    closeButton.click();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('hides the calendar window when no schedule exists', () => {
    const noCalendarDetail: ClientDetail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          calendar: undefined,
          salesStatus: 'open',
          execution: undefined,
        },
      ],
    };
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = noCalendarDetail;
    fixture.detectChanges();
    const calendarEl = fixture.nativeElement.querySelector('.history__calendar') as HTMLElement;
    expect(calendarEl.textContent?.trim()).toContain('Schedule TBD');
  });

  it('falls back to local time label when calendar timezone is missing', () => {
    const localTimeDetail: ClientDetail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          calendar: {
            start: '2026-03-05T10:00:00Z',
            end: '2026-03-05T11:30:00Z',
          },
        },
      ],
    };
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = localTimeDetail;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Local time');
  });

  it('hides optional history sections when fields are missing', () => {
    const sparseDetail: ClientDetail = {
      ...detail,
      history: [
        {
          ...detail.history[0],
          hedgePlan: [],
          desiredBudget: undefined,
          additionalDetails: undefined,
        },
      ],
    };
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = sparseDetail;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.history__hedges')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Desired budget');
    expect(fixture.nativeElement.textContent).not.toContain('Leave debris curbside.');
  });

  it('formats currency for numeric and non-numeric values', () => {
    const drawer = fixture.componentInstance as ClientDetailDrawerComponent & {
      formatCurrency(value: string | number | null | undefined): string;
    };
    expect(drawer.formatCurrency(null)).toBe('--');
    expect(drawer.formatCurrency(1250)).toBe('$1,250');
    expect(drawer.formatCurrency('abc')).toBe('$0');
    expect(drawer.formatCurrency('--')).toBe('--');
  });

  it('defaults client email to blank when editing a client without email', () => {
    fixture.componentInstance.client = { ...detail, email: undefined };
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    expect(fixture.componentInstance.clientForm.controls.email.value).toBe('');
  });

  it('normalizes null email edits to an empty string update', () => {
    const updateSpy = vi.fn();
    fixture.componentInstance.client = { ...detail, email: undefined };
    fixture.componentInstance.updateClient.subscribe(updateSpy);
    fixture.detectChanges();
    fixture.componentInstance['startClientEdit']();
    fixture.componentInstance.clientForm.controls.email.setValue(null as unknown as string);
    fixture.componentInstance['submitClientEdits']();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

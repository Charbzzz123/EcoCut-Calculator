import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ClientDetail } from '../home/services/entry-repository.service.js';
import { createEmptyHedgeConfigs } from '../home/models/entry-modal.models.js';
import { ClientDetailDrawerComponent } from './client-detail-drawer.component.js';

const detail: ClientDetail = {
  clientId: 'alex@example.com',
  fullName: 'Alex Stone',
  address: '123 Pine Ave',
  phone: '(438) 555-1111',
  email: 'alex@example.com',
  jobsCount: 2,
  lastJobDate: '2026-03-04T12:00:00Z',
  history: [
    {
      entryId: 'job-1',
      createdAt: '2026-03-04T12:00:00Z',
      variant: 'customer',
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
      hedges: createEmptyHedgeConfigs(),
    },
  ],
};

describe('ClientDetailDrawerComponent', () => {
  let fixture: ComponentFixture<ClientDetailDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDetailDrawerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ClientDetailDrawerComponent);
    fixture.componentInstance.client = detail;
  });

  it('shows loading state when requested', () => {
    fixture.componentInstance.state = 'loading';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading job history');
  });

  it('renders job history entries', () => {
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = detail;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hedge Trimming');
    expect(fixture.nativeElement.textContent).toContain('Location');
    expect(fixture.nativeElement.textContent).toContain('(438) 555-1111');
  });

  it('emits retry when error state button is clicked', () => {
    const retrySpy = vi.fn();
    fixture.componentInstance.state = 'error';
    fixture.componentInstance.retry.subscribe(retrySpy);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.ghost') as HTMLButtonElement;
    button.click();
    expect(retrySpy).toHaveBeenCalled();
  });

  it('renders empty states when contact data is missing', () => {
    fixture.componentInstance.client = {
      ...detail,
      email: undefined,
      lastJobDate: '',
    };
    const emptyDetail: ClientDetail = { ...detail, history: [] };
    fixture.componentInstance.detail = emptyDetail;
    fixture.componentInstance.state = 'ready';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No jobs recorded yet.');
    expect(fixture.nativeElement.textContent).not.toContain('Email');
  });

  it('emits closed when the close button is clicked', () => {
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.detectChanges();
    const closeButton = fixture.nativeElement.querySelector('.client-drawer__close') as HTMLButtonElement;
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
        },
      ],
    };
    fixture.componentInstance.state = 'ready';
    fixture.componentInstance.detail = noCalendarDetail;
    fixture.detectChanges();
    const calendarEl = fixture.nativeElement.querySelector('.history__calendar') as HTMLElement;
    expect(calendarEl.textContent?.trim()).toContain('Schedule TBD');
  });
});

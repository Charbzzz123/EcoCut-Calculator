import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import type {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
} from '@shared/domain/entry/entry-repository.service.js';
import { ClientDetailOverlayComponent } from './client-detail-overlay.component.js';
import { ClientDetailDrawerComponent } from './client-detail-drawer.component.js';
import { createEmptyHedgeConfigs } from '@shared/domain/entry/entry-modal.models.js';

const summary: ClientSummary = {
  clientId: '1',
  firstName: 'Alex',
  lastName: 'Stone',
  fullName: 'Alex Stone',
  address: '123 Pine',
  phone: '555-1111',
  jobsCount: 1,
  email: 'alex@example.com',
  lastJobDate: '',
  nextJobDate: '',
};

const detail: ClientDetail = { ...summary, history: [] };

describe('ClientDetailOverlayComponent', () => {
  let fixture: ComponentFixture<ClientDetailOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDetailOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDetailOverlayComponent);
    fixture.componentRef.setInput('client', summary);
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges();
  });

  it('emits close when backdrop clicked', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.client-detail-overlay__backdrop') as HTMLButtonElement;
    backdrop.click();
    vi.advanceTimersByTime(220);
    expect(spy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('forwards drawer events', () => {
    vi.useFakeTimers();
    const closeSpy = vi.fn();
    const retrySpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteClientSpy = vi.fn();
    const editSpy = vi.fn();
    const deleteEntrySpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closeSpy);
    fixture.componentInstance.retry.subscribe(retrySpy);
    fixture.componentInstance.updateClient.subscribe(updateSpy);
    fixture.componentInstance.deleteClient.subscribe(deleteClientSpy);
    fixture.componentInstance.editEntry.subscribe(editSpy);
    fixture.componentInstance.deleteEntry.subscribe(deleteEntrySpy);
    const drawerRef = fixture.debugElement.query(By.css('app-client-detail-drawer'));
    const drawerInstance = drawerRef.componentInstance as ClientDetailDrawerComponent;
    drawerInstance.closed.emit();
    drawerInstance.retry.emit();
    drawerInstance.updateClient.emit({ firstName: 'Renamed' });
    drawerInstance.deleteClient.emit();
    drawerInstance.editEntry.emit({
      entryId: 'job',
      createdAt: '',
      variant: 'customer',
      jobType: 'Trim',
      jobValue: '$400',
      location: '',
      contactPhone: '',
      hedges: createEmptyHedgeConfigs(),
    } as ClientHistoryEntry);
    drawerInstance.deleteEntry.emit({
      entryId: 'job-2',
      createdAt: '',
      variant: 'customer',
      jobType: 'Rabattage',
      jobValue: '$200',
      location: '',
      contactPhone: '',
      hedges: createEmptyHedgeConfigs(),
    } as ClientHistoryEntry);
    vi.advanceTimersByTime(220);
    expect(closeSpy).toHaveBeenCalled();
    expect(retrySpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith({ firstName: 'Renamed' });
    expect(deleteClientSpy).toHaveBeenCalled();
    expect(editSpy).toHaveBeenCalled();
    expect(deleteEntrySpy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

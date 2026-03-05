import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import type {
  ClientDetail,
  ClientHistoryEntry,
  ClientSummary,
} from '../home/services/entry-repository.service.js';
import { ClientDetailOverlayComponent } from './client-detail-overlay.component.js';
import { ClientDetailDrawerComponent } from './client-detail-drawer.component.js';
import { createEmptyHedgeConfigs } from '../home/models/entry-modal.models.js';

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
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.client-detail-overlay__backdrop') as HTMLButtonElement;
    backdrop.click();
    expect(spy).toHaveBeenCalled();
  });

  it('forwards drawer events', () => {
    const editSpy = vi.fn();
    fixture.componentInstance.editEntry.subscribe(editSpy);
    const drawerRef = fixture.debugElement.query(By.css('app-client-detail-drawer'));
    const drawerInstance = drawerRef.componentInstance as ClientDetailDrawerComponent;
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
    expect(editSpy).toHaveBeenCalled();
  });
});

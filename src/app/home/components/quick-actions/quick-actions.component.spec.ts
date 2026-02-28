import { TestBed } from '@angular/core/testing';
import { QuickActionsComponent } from './quick-actions.component.js';
import type { QuickAction } from '../../home.models';

const actions: QuickAction[] = [
  {
    id: 'new-job',
    label: 'New Job',
    description: 'Start a calculation',
    icon: '+',
    command: 'new-job',
  },
];

describe('QuickActionsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuickActionsComponent],
    });
  });

  it('emits selected action', () => {
    const fixture = TestBed.createComponent(QuickActionsComponent);
    const component = fixture.componentInstance as QuickActionsComponent;
    component.actions = actions;
    fixture.detectChanges();

    let emitted: string | undefined;
    component.actionSelected.subscribe((cmd: string) => (emitted = cmd));

    const button = fixture.nativeElement.querySelector('button');
    button.click();

    expect(emitted).toBe('new-job');
  });

  it('shows empty state when no actions', () => {
    const fixture = TestBed.createComponent(QuickActionsComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.quick-actions__empty').textContent.trim(),
    ).toContain('Add actions');
  });
});

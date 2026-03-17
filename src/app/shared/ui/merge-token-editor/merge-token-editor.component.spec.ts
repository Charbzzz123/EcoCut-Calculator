import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MergeTokenEditorComponent } from './merge-token-editor.component.js';

describe('MergeTokenEditorComponent', () => {
  let fixture: ComponentFixture<MergeTokenEditorComponent>;
  let component: MergeTokenEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MergeTokenEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MergeTokenEditorComponent);
    component = fixture.componentInstance;
    component.targetId = 'emailBody';
    component.placeholder = 'Write a message';
    component.mergeFields = [
      {
        token: '{{firstName}}',
        label: 'First name',
      },
      {
        token: '{{address}}',
        label: 'Address',
      },
    ];
  });

  it('renders merge values as token chips', () => {
    component.value = 'Hi {{firstName}} at [[Address]]';
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.merge-token-editor__chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('First name');
    expect(chips[1].textContent).toContain('Address');
  });

  it('emits focus and blocks enter in single-line mode', () => {
    component.singleLine = true;
    fixture.detectChanges();

    const focusSpy = vi.fn();
    component.editorFocused.subscribe(focusSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.dispatchEvent(new Event('focus'));
    expect(focusSpy).toHaveBeenCalledTimes(1);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('inserts token and emits updated value', () => {
    component.value = 'Hi ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component.insertToken('[[First name]]', 'First name');

    expect(changeSpy).toHaveBeenCalledWith('Hi [[First name]]');
  });

  it('supports drop insertion with provider payload', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((kind: string) => {
          if (kind === 'application/ecocut-merge-token') {
            return '[[Address]]';
          }
          if (kind === 'application/ecocut-merge-label') {
            return 'Address';
          }
          return '';
        }),
      },
    } as unknown as DragEvent);

    expect(changeSpy).toHaveBeenCalledWith('Hello [[Address]]');
  });

  it('moves an existing token chip when dragging inside the editor', () => {
    component.value = 'Hi {{firstName}} there';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    const transfer = {
      getData: vi.fn((kind: string) => {
        if (kind === 'application/ecocut-merge-token') {
          return '{{firstName}}';
        }
        if (kind === 'application/ecocut-merge-label') {
          return 'First name';
        }
        return '';
      }),
      setData: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    component['onEditorDragStart']({ target: chip, dataTransfer: transfer } as unknown as DragEvent);
    expect(chip.classList.contains('merge-token-editor__chip--dragging')).toBe(true);
    expect(transfer.setData).toHaveBeenCalledWith('application/ecocut-merge-token', '{{firstName}}');

    component['onEditorDragOver']({ preventDefault: vi.fn(), dataTransfer: transfer } as unknown as DragEvent);
    expect(transfer.dropEffect).toBe('move');

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      currentTarget: editor,
      target: editor,
      dataTransfer: transfer,
    } as unknown as DragEvent);

    const latestValue = changeSpy.mock.calls[changeSpy.mock.calls.length - 1]?.[0] as string;
    expect((latestValue.match(/\{\{firstName\}\}/g) ?? []).length).toBe(1);
  });

  it('clears drag state on drag end and keeps copy mode for external drags', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement | null;
    if (chip) {
      component['onEditorDragStart']({
        target: chip,
        dataTransfer: { setData: vi.fn() },
      } as unknown as DragEvent);
      component['onEditorDragEnd']();
      expect(chip.classList.contains('merge-token-editor__chip--dragging')).toBe(false);
    }

    const transfer = { dropEffect: 'none' };
    component['onEditorDragOver']({ preventDefault: vi.fn(), dataTransfer: transfer } as unknown as DragEvent);
    expect(transfer.dropEffect).toBe('copy');
  });
});

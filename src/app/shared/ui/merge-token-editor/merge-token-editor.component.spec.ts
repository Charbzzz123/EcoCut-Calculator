import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
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

  afterEach(() => {
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = undefined;
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

  it('re-renders when input value changes after initial render', () => {
    component.value = 'Hi {{firstName}}';
    fixture.detectChanges();

    component.value = 'Hello {{address}}';
    component.ngOnChanges({
      value: new SimpleChange('Hi {{firstName}}', 'Hello {{address}}', false),
    });

    const chips = fixture.nativeElement.querySelectorAll('.merge-token-editor__chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Address');
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

  it('ignores drop when token payload is empty', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn(() => ''),
      },
    } as unknown as DragEvent);

    expect(changeSpy).not.toHaveBeenCalled();
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

  it('does nothing when drag starts from a non-chip target or chip without token', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const setData = vi.fn();
    component['onEditorDragStart']({
      target: document.createElement('div'),
      dataTransfer: { setData },
    } as unknown as DragEvent);

    const chipWithoutToken = document.createElement('span');
    chipWithoutToken.className = 'merge-token-editor__chip';
    component['onEditorDragStart']({
      target: chipWithoutToken,
      dataTransfer: { setData },
    } as unknown as DragEvent);

    expect(setData).not.toHaveBeenCalled();
  });

  it('uses caretPositionFromPoint when available during dragover', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: textNode,
      offset: 2,
    }));

    const transfer = { dropEffect: 'none' };
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 12,
      clientY: 14,
      dataTransfer: transfer,
    } as unknown as DragEvent);

    expect(transfer.dropEffect).toBe('copy');
  });

  it('falls back to caretRangeFromPoint when caretPositionFromPoint is unavailable', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = vi.fn(() => range);

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);

    const selection = window.getSelection();
    expect(selection?.rangeCount).toBeGreaterThan(0);
  });

  it('keeps selection safe when pointer coordinates are invalid', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const before = window.getSelection()?.rangeCount ?? 0;
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: Number.NaN,
      clientY: Number.NaN,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);
    const after = window.getSelection()?.rangeCount ?? 0;

    expect(after).toBe(before);
  });

  it('does not emit when input serialization keeps the same value', () => {
    component.value = 'No change';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.dispatchEvent(new Event('input'));

    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('uses plain text fallback on drop when custom payload is missing', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((kind: string) => {
          if (kind === 'application/ecocut-merge-token') {
            return undefined as unknown as string;
          }
          return kind === 'text/plain' ? '[[Address]]' : '';
        }),
      },
    } as unknown as DragEvent);

    expect(changeSpy).toHaveBeenCalledWith('Hello [[Address]]');
  });

  it('ignores caret updates when resolved caret target is outside editor', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: document.createTextNode('outside'),
      offset: 1,
    }));

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);

    const selection = window.getSelection();
    expect(selection?.rangeCount ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('serializes block elements with line breaks', () => {
    component.value = 'Base';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.innerHTML = '<div>Line 1</div><p>Line 2</p><br>Tail';

    editor.dispatchEvent(new Event('input'));
    const latest = changeSpy.mock.calls[changeSpy.mock.calls.length - 1]?.[0] as string;
    expect(latest).toContain('Line 1\n');
    expect(latest).toContain('Line 2\n');
    expect(latest).toContain('Tail');
  });

  it('returns inline token label when canonical map is missing', () => {
    component.mergeFields = [];
    component.value = '[[Inline label]]';
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    expect(chip.textContent).toContain('Inline label');
  });
});

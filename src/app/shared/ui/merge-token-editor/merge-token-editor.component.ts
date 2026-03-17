import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  ViewEncapsulation,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

interface MergeFieldDescriptor {
  token: string;
  label: string;
}

interface CaretPositionApi {
  offsetNode: Node;
  offset: number;
}

interface CaretDocumentApi {
  caretPositionFromPoint?: (x: number, y: number) => CaretPositionApi | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
}

@Component({
  selector: 'app-merge-token-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './merge-token-editor.component.html',
  styleUrl: './merge-token-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class MergeTokenEditorComponent implements OnChanges, AfterViewInit {
  @Input({ required: true }) value = '';
  @Input() placeholder = '';
  @Input() ariaLabel = '';
  @Input() targetId = '';
  @Input() singleLine = false;
  @Input() mergeFields: readonly MergeFieldDescriptor[] = [];

  @Output() valueChange = new EventEmitter<string>();
  @Output() editorFocused = new EventEmitter<void>();

  @ViewChild('editor', { static: true }) private editorRef?: ElementRef<HTMLDivElement>;

  private internalValue = '';
  private readonly tokenExpression = /(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.internalValue = this.value;
    this.renderFromValue(this.value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes && this.value !== this.internalValue && this.viewReady) {
      this.internalValue = this.value;
      this.renderFromValue(this.internalValue);
    }
  }

  protected onEditorFocus(): void {
    this.editorFocused.emit();
  }

  protected onEditorKeydown(event: KeyboardEvent): void {
    if (this.singleLine && event.key === 'Enter') {
      event.preventDefault();
    }
  }

  protected onEditorInput(): void {
    const nextValue = this.serializeEditorValue();
    if (nextValue === this.internalValue) {
      return;
    }
    this.internalValue = nextValue;
    this.valueChange.emit(nextValue);
  }

  protected onEditorDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.placeCaretFromPointer(event);
  }

  protected onEditorDrop(event: DragEvent): void {
    event.preventDefault();
    const token =
      event.dataTransfer?.getData('application/ecocut-merge-token') ??
      event.dataTransfer?.getData('text/plain') ??
      '';
    if (!token.trim()) {
      return;
    }
    const label =
      event.dataTransfer?.getData('application/ecocut-merge-label') ??
      this.resolveLabelFromToken(token);
    this.placeCaretFromPointer(event);
    this.insertToken(token, label);
  }

  public insertToken(token: string, label: string): void {
    const editor = this.editorRef?.nativeElement;
    if (!editor) {
      return;
    }
    this.ensureSelectionInEditor(editor);
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const tokenNode = this.createTokenNode(token, label);
    range.insertNode(tokenNode);
    const caretRange = document.createRange();
    caretRange.setStartAfter(tokenNode);
    caretRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caretRange);
    this.onEditorInput();
  }

  private ensureSelectionInEditor(editor: HTMLDivElement): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }

  private placeCaretFromPointer(event: DragEvent): void {
    const editor = this.editorRef?.nativeElement;
    if (!editor) {
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    const docWithCaret = document as Document & CaretDocumentApi;
    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    if (typeof docWithCaret.caretPositionFromPoint === 'function') {
      const position = docWithCaret.caretPositionFromPoint(x, y);
      if (!position || !editor.contains(position.offsetNode)) {
        return;
      }
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    if (typeof docWithCaret.caretRangeFromPoint === 'function') {
      const range = docWithCaret.caretRangeFromPoint(x, y);
      if (!range || !editor.contains(range.startContainer)) {
        return;
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  private createTokenNode(token: string, label: string): HTMLSpanElement {
    const node = document.createElement('span');
    node.className = 'merge-token-editor__chip';
    node.setAttribute('contenteditable', 'false');
    node.dataset['mergeToken'] = token;
    node.textContent = label;
    return node;
  }

  private resolveLabelFromToken(token: string): string {
    const fromCanonical = this.mergeFields.find((field) => field.token === token);
    if (fromCanonical) {
      return fromCanonical.label;
    }
    const inlineLabelMatch = token.match(/^\[\[(.+)\]\]$/);
    if (inlineLabelMatch?.[1]) {
      return inlineLabelMatch[1].trim();
    }
    return token;
  }

  private serializeEditorValue(): string {
    const editor = this.editorRef?.nativeElement;
    if (!editor) {
      return '';
    }
    const serialized = this.serializeNodes(editor.childNodes)
      .replace(/\r/g, '')
      .replace(/\u00a0/g, ' ');
    return serialized;
  }

  private serializeNodes(nodes: NodeList): string {
    let output = '';
    nodes.forEach((node) => {
      output += this.serializeNode(node);
    });
    return output;
  }

  private serializeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (!(node instanceof HTMLElement)) {
      return '';
    }
    const token = node.dataset['mergeToken'];
    if (token) {
      return token;
    }
    if (node.tagName === 'BR') {
      return '\n';
    }
    const inner = this.serializeNodes(node.childNodes);
    if ((node.tagName === 'DIV' || node.tagName === 'P') && inner.length > 0) {
      return `${inner}\n`;
    }
    return inner;
  }

  private renderFromValue(value: string): void {
    const editor = this.editorRef?.nativeElement;
    if (!editor) {
      return;
    }
    editor.innerHTML = '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of value.matchAll(this.tokenExpression)) {
      const index = match.index ?? 0;
      if (index > cursor) {
        this.appendText(fragment, value.slice(cursor, index));
      }
      const token = match[0] ?? '';
      const label = this.resolveLabelFromToken(token);
      fragment.append(this.createTokenNode(token, label));
      cursor = index + token.length;
    }
    if (cursor < value.length) {
      this.appendText(fragment, value.slice(cursor));
    }
    editor.append(fragment);
  }

  private appendText(fragment: DocumentFragment, text: string): void {
    const segments = text.split('\n');
    segments.forEach((segment, index) => {
      if (index > 0) {
        fragment.append(document.createElement('br'));
      }
      if (segment.length > 0) {
        fragment.append(document.createTextNode(segment));
      }
    });
  }
}

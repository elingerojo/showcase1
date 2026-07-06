import { Component, inject, signal, DestroyRef } from '@angular/core';
import { AguiSse } from '../services/agui-sse';
import { AguiEvent, MathOp } from '@shared/models/messageTypes';

export type ChatSegment =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool-call'; a: number; b: number; op: MathOp; symbol: string }
  | { type: 'tool-result'; value: number };

export interface AiEntry {
  segments: ChatSegment[];
  status: 'streaming' | 'done' | 'error';
}

export type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'ai'; data: AiEntry };

@Component({
  selector: 'app-chat',
  imports: [],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat {
  private sse = inject(AguiSse);
  private destroyRef = inject(DestroyRef);

  readonly inputText = signal('');
  readonly loading = signal(false);
  readonly entries = signal<ChatEntry[]>([]);

  readonly SYM: Record<MathOp, string> = {
    add: '+',
    sub: '−',
    mul: '×',
    div: '÷',
  };

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.loading()) return;

    this.inputText.set('');
    this.loading.set(true);

    // Push user entry
    this.entries.update((prev) => [...prev, { kind: 'user', text }]);

    // Create a fresh AI entry for streaming
    const aiEntry: AiEntry = { segments: [], status: 'streaming' };
    this.entries.update((prev) => [...prev, { kind: 'ai', data: aiEntry }]);

    const sub = this.sse.sendMessage(text).subscribe({
      next: (event) => this.handleEvent(event, aiEntry),
      error: (err) => {
        aiEntry.status = 'error';
        aiEntry.segments.push({
          type: 'text',
          text: (err as Error).message ?? 'Connection failed',
        });
        this.loading.set(false);
      },
      complete: () => {
        aiEntry.status = 'done';
        this.loading.set(false);
      },
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private handleEvent(event: AguiEvent, entry: AiEntry): void {
    switch (event.event) {
      case 'AGUI_REASONING_DELTA': {
        const last = entry.segments.at(-1);
        if (last?.type === 'thinking') {
          last.text += event.reasoning;
        } else {
          // Inicia un nuevo segmento "thinking" con lo que 'llegó'
          // (el segmento anterior, sea cual sea, excepto "thinking", 'ya termino')
          entry.segments.push({ type: 'thinking', text: event.reasoning });
        }
        break;
      }
      case 'AGUI_TEXT_DELTA': {
        const last = entry.segments.at(-1);
        if (last?.type === 'text') {
          last.text += event.text;
        } else {
          // Inicia un nuevo segmento "text" con lo que 'llegó'
          // (el segmento anterior, sea cual sea, excepto "text", 'ya termino')
          entry.segments.push({ type: 'text', text: event.text });
        }
        break;
      }
      case 'AGUI_TOOL_CALL': {
        const { op, a, b } = event.args;
        entry.segments.push({
          type: 'tool-call',
          a,
          b,
          op,
          symbol: this.SYM[op] ?? op,
        });
        break;
      }
      case 'AGUI_TOOL_RESULT':
        entry.segments.push({ type: 'tool-result', value: event.res });
        break;
      case 'AGUI_LIFECYCLE':
        if (event.status === 'completed') {
          entry.status = 'done';
          this.loading.set(false);
        }
        break;
      case 'AGUI_ERROR':
        entry.status = 'error';
        entry.segments.push({ type: 'text', text: event.message });
        this.loading.set(false);
        break;
    }
    // Trigger signal update (mutated array needs re-assignment)
    this.entries.update((prev) => [...prev]);
  }
}

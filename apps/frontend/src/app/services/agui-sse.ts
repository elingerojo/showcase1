import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AguiEvent } from '@shared/models/messageTypes';

@Service()
export class AguiSse {
  private readonly API_URL = environment.apiUrl; // Automatically resolves to the right URL

  blockCount = 0;

  /**
   * Sends a message and streams back AguiEvent objects via SSE.
   * Each SSE `data:` line emits one event via `subscriber.next()`.
   * Completes when the stream ends, or errors on failure.
   */
  sendMessage(text: string): Observable<AguiEvent> {
    return new Observable<AguiEvent>((subscriber) => {
      const controller = new AbortController();

      fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok || !res.body) {
            throw new Error(`Server responded with ${res.status}`);
          }

          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buf += dec.decode(value, { stream: true });
            const blocks = buf.split('\n\n');
            buf = blocks.pop() ?? '';

            for (const block of blocks) {
              this.blockCount += 1;
              console.log(this.blockCount, block);
              if (!block.startsWith('data: ')) continue;
              subscriber.next(JSON.parse(block.slice(6)) as AguiEvent);
            }
          }

          this.blockCount = 0;

          subscriber.complete();
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          subscriber.error(err);
        });

      // Cleanup: abort fetch on unsubscribe
      return () => controller.abort();
    });
  }
}

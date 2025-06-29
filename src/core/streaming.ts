export interface StreamEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export class SSEParser {
  private buffer = "";

  parse(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    let currentEvent: Partial<StreamEvent> = {};

    for (const line of lines) {
      if (line === "") {
        if (currentEvent.data !== undefined) {
          events.push(currentEvent as StreamEvent);
        }
        currentEvent = {};
        continue;
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const field = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      switch (field) {
        case "data":
          currentEvent.data = value;
          break;
        case "event":
          currentEvent.event = value;
          break;
        case "id":
          currentEvent.id = value;
          break;
        case "retry":
          currentEvent.retry = parseInt(value, 10);
          break;
      }
    }

    return events;
  }

  reset(): void {
    this.buffer = "";
  }
}

export class StreamProcessor {
  private parser = new SSEParser();
  private abortController?: AbortController;

  async *processStream(response: Response): AsyncGenerator<StreamEvent, void, unknown> {
    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = this.parser.parse(chunk);

        for (const event of events) {
          if (event.data === "[DONE]") {
            return;
          }
          yield event;
        }
      }
    } finally {
      reader.releaseLock();
      this.parser.reset();
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  setAbortController(controller: AbortController): void {
    this.abortController = controller;
  }
}

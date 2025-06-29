import { EventEmitter } from "../../core/events";
import { StreamProcessor } from "../../core/streaming";
import { CompletionChunk, CompletionStreamEventMap } from "../../types/completions";
import { APIUserAbortError } from "../../core/errors";

export class CompletionStreamingRunner extends EventEmitter<CompletionStreamEventMap> {
  private streamProcessor = new StreamProcessor();
  private abortController = new AbortController();
  private textSnapshot = "";
  private isComplete = false;
  private _finalText: string | null = null;

  constructor(private response: Response) {
    super();
    this.processStream();
  }

  private async processStream(): Promise<void> {
    try {
      this.streamProcessor.setAbortController(this.abortController);

      for await (const event of this.streamProcessor.processStream(this.response)) {
        if (this.abortController.signal.aborted) {
          this.emit("abort", undefined);
          return;
        }

        try {
          const chunk = JSON.parse(event.data) as CompletionChunk;
          this.emit("chunk", chunk);

          const choice = chunk.choices[0];
          if (choice?.text) {
            this.textSnapshot += choice.text;

            this.emit("text.delta", {
              delta: choice.text,
              snapshot: this.textSnapshot,
            });
          }

          const finishReason = choice?.finish_reason;
          if (finishReason) {
            this._finalText = this.textSnapshot;
            this.isComplete = true;

            this.emit("text.done", {
              text: this.textSnapshot,
            });
          }
        } catch (error) {
          this.emit("error", error instanceof Error ? error : new Error("Failed to parse chunk"));
        }
      }

      if (!this.isComplete) {
        this._finalText = this.textSnapshot;
        this.isComplete = true;
        this.emit("text.done", { text: this.textSnapshot });
      }

      this.emit("end", undefined);
    } catch (error) {
      if (this.abortController.signal.aborted) {
        this.emit("abort", undefined);
      } else {
        this.emit("error", error instanceof Error ? error : new Error("Stream processing failed"));
      }
    }
  }

  abort(): void {
    this.abortController.abort();
    this.emit("abort", undefined);
  }

  async done(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isComplete) {
        resolve();
        return;
      }

      const cleanup = () => {
        this.off("end", onEnd);
        this.off("error", onError);
        this.off("abort", onAbort);
      };

      const onEnd = () => {
        cleanup();
        resolve();
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        cleanup();
        reject(new APIUserAbortError());
      };

      this.once("end", onEnd);
      this.once("error", onError);
      this.once("abort", onAbort);
    });
  }

  async finalText(): Promise<string> {
    if (this._finalText !== null) {
      return this._finalText;
    }

    await this.done();
    return this._finalText || "";
  }

  [Symbol.asyncIterator](): AsyncIterator<CompletionChunk> {
    const chunks: CompletionChunk[] = [];
    let chunkIndex = 0;
    let isComplete = false;
    let error: Error | null = null;

    this.on("chunk", (chunk) => {
      chunks.push(chunk);
    });

    this.on("end", () => {
      isComplete = true;
    });

    this.on("error", (err) => {
      error = err;
      isComplete = true;
    });

    this.on("abort", () => {
      error = new APIUserAbortError();
      isComplete = true;
    });

    return {
      async next(): Promise<IteratorResult<CompletionChunk>> {
        while (chunkIndex >= chunks.length && !isComplete) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        if (error) {
          throw error;
        }

        if (chunkIndex < chunks.length) {
          return { value: chunks[chunkIndex++], done: false };
        }

        return { value: undefined, done: true };
      },
    };
  }
}

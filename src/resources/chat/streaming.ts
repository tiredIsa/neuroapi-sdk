import { EventEmitter } from "../../core/events";
import { StreamProcessor } from "../../core/streaming";
import { ChatCompletionChunk, StreamEventMap, ContentDeltaEvent, ContentDoneEvent, ToolCallDeltaEvent, ToolCallDoneEvent, ChatCompletionMessageToolCall } from "../../types/chat";
import { APIUserAbortError } from "../../core/errors";

export class ChatCompletionStreamingRunner extends EventEmitter<StreamEventMap> {
  private streamProcessor = new StreamProcessor();
  private abortController = new AbortController();
  private contentSnapshot = "";
  private isComplete = false;
  private _finalContent: string | null = null;
  private toolCallsSnapshot: Record<number, ChatCompletionMessageToolCall> = {};
  private _finalToolCalls: ChatCompletionMessageToolCall[] | null = null;

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
          const chunk = JSON.parse(event.data) as ChatCompletionChunk;
          this.emit("chunk", chunk);

          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            this.contentSnapshot += delta.content;

            this.emit("content.delta", {
              delta: delta.content,
              snapshot: this.contentSnapshot,
            });
          }

          if (delta?.tool_calls) {
            this.handleToolCallsDelta(delta.tool_calls);
          }

          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason) {
            this._finalContent = this.contentSnapshot;
            this._finalToolCalls = Object.values(this.toolCallsSnapshot);
            this.isComplete = true;

            if (this.contentSnapshot) {
              this.emit("content.done", {
                content: this.contentSnapshot,
              });
            }

            for (let i = 0; i < Object.keys(this.toolCallsSnapshot).length; i++) {
              if (this.toolCallsSnapshot[i]) {
                this.emit("tool_calls.function.arguments.done", {
                  index: i,
                  toolCall: this.toolCallsSnapshot[i],
                });
              }
            }
          }
        } catch (error) {
          this.emit("error", error instanceof Error ? error : new Error("Failed to parse chunk"));
        }
      }

      if (!this.isComplete) {
        this._finalContent = this.contentSnapshot;
        this.isComplete = true;
        this.emit("content.done", { content: this.contentSnapshot });
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

  async finalContent(): Promise<string> {
    if (this._finalContent !== null) {
      return this._finalContent;
    }

    await this.done();
    return this._finalContent || "";
  }

  [Symbol.asyncIterator](): AsyncIterator<ChatCompletionChunk> {
    const chunks: ChatCompletionChunk[] = [];
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
      async next(): Promise<IteratorResult<ChatCompletionChunk>> {
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

  private handleToolCallsDelta(toolCallDeltas: ChatCompletionMessageToolCall[]): void {
    for (const toolCallDelta of toolCallDeltas) {
      if (typeof toolCallDelta.index === "undefined") {
        continue;
      }

      const index = toolCallDelta.index;

      if (!this.toolCallsSnapshot[index]) {
        this.toolCallsSnapshot[index] = {
          id: toolCallDelta.id || "",
          type: "function",
          function: {
            name: "",
            arguments: "",
          },
        };
      }

      const snapshot = this.toolCallsSnapshot[index];

      if (toolCallDelta.id) {
        snapshot.id = toolCallDelta.id;
      }

      if (toolCallDelta.function) {
        if (toolCallDelta.function.name) {
          snapshot.function.name = toolCallDelta.function.name;
        }
        if (toolCallDelta.function.arguments) {
          snapshot.function.arguments += toolCallDelta.function.arguments;
        }
      }

      this.emit("tool_calls.function.arguments.delta", {
        index,
        toolCall: toolCallDelta,
        snapshot: { ...snapshot },
      });
    }
  }

  async finalToolCalls(): Promise<ChatCompletionMessageToolCall[]> {
    if (this._finalToolCalls !== null) {
      return this._finalToolCalls;
    }

    await this.done();
    return this._finalToolCalls || [];
  }
}

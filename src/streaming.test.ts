import { describe, it, expect } from "bun:test";
import { ChatCompletionStreamingRunner } from "./resources/chat/streaming";
import { CompletionStreamingRunner } from "./resources/completions/streaming";

// Mock streaming response helper
function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

describe("ChatCompletionStreamingRunner", () => {
  it("should process basic streaming response", async () => {
    const chunks = [
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    const contentDeltas: string[] = [];
    let finalContent = "";
    let isContentDone = false;

    runner.on("content.delta", (event) => {
      contentDeltas.push(event.delta);
    });

    runner.on("content.done", (event) => {
      finalContent = event.content;
      isContentDone = true;
    });

    await runner.done();

    expect(contentDeltas).toEqual(["Hello", " world"]);
    expect(finalContent).toBe("Hello world");
    expect(isContentDone).toBe(true);
  });

  it("should handle tool calls in streaming", async () => {
    const chunks = [
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_abc123","type":"function","function":{"name":"get_weather","arguments":"{\\"location"}}]},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\":\\"Boston\\"}"}}]},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    const toolCallEvents: any[] = [];
    let toolCallsDone = false;

    runner.on("tool_calls.function.arguments.delta", (event) => {
      toolCallEvents.push(event);
    });

    runner.on("tool_calls.function.arguments.done", (event) => {
      toolCallsDone = true;
      expect(event.toolCall.function.name).toBe("get_weather");
      expect(event.toolCall.function.arguments).toBe('{"location":"Boston"}');
    });

    await runner.done();

    expect(toolCallEvents.length).toBeGreaterThan(0);
    expect(toolCallsDone).toBe(true);
  });

  it("should handle stream abort", async () => {
    const chunks = [
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let aborted = false;
    runner.on("abort", () => {
      aborted = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    runner.abort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(aborted).toBe(true);
  });

  it("should handle malformed JSON chunks", async () => {
    const chunks = [
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
      "data: {malformed json\n\n",
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let errorOccurred = false;
    runner.on("error", (error) => {
      errorOccurred = true;
      expect(error.message).toContain("Failed to parse chunk");
    });

    const contentDeltas: string[] = [];
    runner.on("content.delta", (event) => {
      contentDeltas.push(event.delta);
    });

    await runner.done().catch(() => {
      // Ожидаем ошибку из-за malformed JSON
    });

    expect(errorOccurred).toBe(true);
    expect(contentDeltas).toEqual(["Hello"]);
  });

  it("should support async iteration", async () => {
    const chunks = [
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    const receivedChunks: any[] = [];

    for await (const chunk of runner) {
      receivedChunks.push(chunk);
    }

    expect(receivedChunks).toHaveLength(2);
    expect(receivedChunks[0].choices[0].delta.content).toBe("Hello");
    expect(receivedChunks[1].choices[0].delta.content).toBe(" world");
  });
});

describe("CompletionStreamingRunner", () => {
  it("should process basic completion streaming", async () => {
    const chunks = [
      'data: {"id":"cmpl-123","object":"text_completion","created":1678901234,"model":"text-davinci-003","choices":[{"text":"Hello","index":0,"logprobs":null,"finish_reason":null}]}\n\n',
      'data: {"id":"cmpl-123","object":"text_completion","created":1678901234,"model":"text-davinci-003","choices":[{"text":" world","index":0,"logprobs":null,"finish_reason":"stop"}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const mockResponse = createMockStreamResponse(chunks);
    const runner = new CompletionStreamingRunner(mockResponse);

    const textDeltas: string[] = [];
    let finalText = "";

    runner.on("text.delta", (event) => {
      textDeltas.push(event.delta);
    });

    runner.on("text.done", (event) => {
      finalText = event.text;
    });

    await runner.done();

    expect(textDeltas).toEqual(["Hello", " world"]);
    expect(finalText).toBe("Hello world");
  });
});

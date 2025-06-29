import { describe, it, expect } from "bun:test";
import { ChatCompletionStreamingRunner } from "../resources/chat/streaming";

function createLargeStreamResponse(chunkCount: number = 1000): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
        )
      );

      for (let i = 0; i < chunkCount; i++) {
        const chunk = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"chunk ${i} "},"finish_reason":null}]}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }

      controller.enqueue(
        encoder.encode('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n')
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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

function createRapidStreamResponse(intervalMs: number = 1): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let count = 0;
      const maxChunks = 100;

      const sendChunk = () => {
        if (count >= maxChunks) {
          controller.enqueue(
            encoder.encode('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n')
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const chunk = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"${count} "},"finish_reason":null}]}\n\n`;
        controller.enqueue(encoder.encode(chunk));
        count++;

        setTimeout(sendChunk, intervalMs);
      };

      controller.enqueue(
        encoder.encode(
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
        )
      );

      setTimeout(sendChunk, intervalMs);
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

describe("Performance Tests", () => {
  it("should handle large number of chunks efficiently", async () => {
    const chunkCount = 1000;
    const mockResponse = createLargeStreamResponse(chunkCount);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    const startTime = Date.now();
    let receivedChunks = 0;

    runner.on("content.delta", () => {
      receivedChunks++;
    });

    await runner.done();
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(receivedChunks).toBe(chunkCount);
    expect(processingTime).toBeLessThan(5000); // Должно обработаться за 5 секунд

    console.log(`Processed ${chunkCount} chunks in ${processingTime}ms (${((chunkCount / processingTime) * 1000).toFixed(2)} chunks/sec)`);
  });

  it("should handle rapid streaming without memory leaks", async () => {
    const mockResponse = createRapidStreamResponse(1);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    const startTime = Date.now();
    let contentDeltas = 0;
    const memoryUsage: number[] = [];

    runner.on("content.delta", () => {
      contentDeltas++;
      if (contentDeltas % 10 === 0) {
        const used = process.memoryUsage();
        memoryUsage.push(used.heapUsed);
      }
    });

    await runner.done();
    const endTime = Date.now();

    expect(contentDeltas).toBe(100);
    expect(endTime - startTime).toBeLessThan(2000); // Увеличиваем время для Windows

    // Проверяем на значительный рост памяти
    if (memoryUsage.length > 2) {
      const memoryGrowth = memoryUsage[memoryUsage.length - 1] - memoryUsage[0];
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      expect(memoryGrowthMB).toBeLessThan(50); // Не более 50MB роста

      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB`);
    }
  });

  it("should handle concurrent streaming efficiently", async () => {
    const concurrentStreams = 10;
    const chunksPerStream = 100;

    const promises = Array.from({ length: concurrentStreams }, async (_, index) => {
      const mockResponse = createLargeStreamResponse(chunksPerStream);
      const runner = new ChatCompletionStreamingRunner(mockResponse);

      let receivedChunks = 0;
      runner.on("content.delta", () => {
        receivedChunks++;
      });

      await runner.done();
      return { streamIndex: index, receivedChunks };
    });

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    const totalChunks = results.reduce((sum, r) => sum + r.receivedChunks, 0);

    expect(results).toHaveLength(concurrentStreams);
    expect(totalChunks).toBe(concurrentStreams * chunksPerStream);
    expect(totalTime).toBeLessThan(10000); // 10 секунд для всех потоков

    console.log(`Processed ${concurrentStreams} concurrent streams (${totalChunks} total chunks) in ${totalTime}ms`);
  });

  it("should handle early abort without performance impact", async () => {
    const chunkCount = 10000; // Большое количество chunks
    const mockResponse = createLargeStreamResponse(chunkCount);
    const runner = new ChatCompletionStreamingRunner(mockResponse);

    let receivedChunks = 0;
    runner.on("content.delta", () => {
      receivedChunks++;
      if (receivedChunks === 10) {
        runner.abort(); // Прерываем рано
      }
    });

    const startTime = Date.now();

    try {
      await runner.done();
    } catch (error) {
      // Ожидаем APIUserAbortError
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(receivedChunks).toBeLessThanOrEqual(20); // Не должно быть много chunks после abort
    expect(processingTime).toBeLessThan(100); // Должно прерваться быстро

    console.log(`Aborted after ${receivedChunks} chunks in ${processingTime}ms`);
  });

  it("should maintain performance with large content accumulation", async () => {
    const chunkCount = 500;
    const largeChunkSize = 1000; // 1KB per chunk

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n'
          )
        );

        for (let i = 0; i < chunkCount; i++) {
          const largeContent = "x".repeat(largeChunkSize);
          const chunk = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"${largeContent}"},"finish_reason":null}]}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }

        controller.enqueue(
          encoder.encode('data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1678901234,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n')
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const mockResponse = new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

    const runner = new ChatCompletionStreamingRunner(mockResponse);
    const startTime = Date.now();

    await runner.done();
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const finalContent = await runner.finalContent();
    const expectedContentSize = chunkCount * largeChunkSize;

    expect(finalContent.length).toBe(expectedContentSize);
    expect(processingTime).toBeLessThan(5000); // 5 секунд для ~500KB контента

    console.log(`Processed ${expectedContentSize} characters in ${processingTime}ms`);
  });
});
